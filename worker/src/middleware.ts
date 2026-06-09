import type { Context, Next } from 'hono';
import { verifyJwt } from './lib/jwt';
import { hasPermission, parsePermissions, type Permission } from './lib/rbac';
import type { AppContext } from './types';

/** Validates the bearer token, loads the user + role, rejects revoked/expired sessions. */
export async function requireAuth(c: Context<AppContext>, next: Next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'Authentication required' }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload || payload.purpose !== 'access') return c.json({ error: 'Invalid or expired token' }, 401);

  const session = await c.env.DB.prepare(
    `SELECT id FROM auth_sessions WHERE id = ? AND revoked = 0 AND expires_at > datetime('now')`,
  )
    .bind(payload.jti)
    .first();
  if (!session) return c.json({ error: 'Session expired or revoked' }, 401);

  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.office_location, u.active, r.id AS role_id, r.name AS role_name, r.permissions
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
  )
    .bind(payload.sub)
    .first<any>();
  if (!row || !row.active) return c.json({ error: 'Account disabled' }, 403);

  c.set('user', {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roleId: row.role_id,
    roleName: row.role_name,
    permissions: parsePermissions(row.permissions),
    officeLocation: row.office_location,
    jwt: payload,
  });
  await next();
}

export function requirePermission(permission: Permission) {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get('user');
    if (!user || !hasPermission(user.permissions, permission)) {
      return c.json({ error: `Missing permission: ${permission}` }, 403);
    }
    await next();
  };
}

export function clientIp(c: Context<AppContext>): string {
  return c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '';
}

export function deviceFromUserAgent(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

export async function audit(
  c: Context<AppContext>,
  action: string,
  entity = '',
  entityId: string | number = '',
  detail: Record<string, unknown> = {},
) {
  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(user?.id ?? null, action, entity, String(entityId), JSON.stringify(detail), clientIp(c))
    .run();
}
