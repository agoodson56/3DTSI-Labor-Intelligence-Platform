import { Hono } from 'hono';
import { hashPassword, verifyPassword, randomHex } from '../lib/crypto';
import { signJwt, verifyJwt } from '../lib/jwt';
import { generateTotpSecret, verifyTotp, otpauthUrl } from '../lib/totp';
import { requireAuth, clientIp, deviceFromUserAgent, audit } from '../middleware';
import type { AppContext } from '../types';

const auth = new Hono<AppContext>();

function sessionMinutes(envValue: string): number {
  const n = parseInt(envValue, 10);
  return Number.isFinite(n) && n > 0 ? n : 480;
}

async function issueAccessToken(c: any, user: any, mfaUsed: boolean) {
  const jti = randomHex(16);
  const minutes = sessionMinutes(c.env.SESSION_TIMEOUT_MINUTES);
  const now = Math.floor(Date.now() / 1000);
  const ua = c.req.header('User-Agent') ?? '';

  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, ip_address, user_agent, device, expires_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' minutes'))`,
  )
    .bind(jti, user.id, clientIp(c), ua, deviceFromUserAgent(ua), minutes)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO login_history (user_id, email, success, mfa_used, ip_address, user_agent, device)
     VALUES (?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(user.id, user.email, mfaUsed ? 1 : 0, clientIp(c), ua, deviceFromUserAgent(ua))
    .run();

  const token = await signJwt(
    {
      sub: user.id,
      jti,
      role: user.role_name,
      name: user.full_name,
      purpose: 'access',
      iat: now,
      exp: now + minutes * 60,
    },
    c.env.JWT_SECRET,
  );
  return { token, expiresInMinutes: minutes };
}

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role_name,
    permissions: JSON.parse(u.permissions ?? '[]'),
    officeLocation: u.office_location,
    mfaEnabled: !!u.mfa_enabled,
  };
}

const USER_QUERY = `SELECT u.*, r.name AS role_name, r.permissions FROM users u JOIN roles r ON r.id = u.role_id`;

/** One-time first-run setup: creates the initial Administrator when no users exist. */
auth.post('/bootstrap', async (c) => {
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>();
  if ((count?.n ?? 0) > 0) return c.json({ error: 'Already initialized' }, 409);

  const body = await c.req.json<{ email: string; password: string; fullName: string }>();
  if (!body.email || !body.password || body.password.length < 10 || !body.fullName) {
    return c.json({ error: 'email, fullName, and a password of at least 10 characters are required' }, 400);
  }
  const { hash, salt } = await hashPassword(body.password);
  const role = await c.env.DB.prepare(`SELECT id FROM roles WHERE name = 'Administrator'`).first<{ id: number }>();
  await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, password_salt, full_name, role_id) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(body.email.toLowerCase(), hash, salt, body.fullName, role!.id)
    .run();
  return c.json({ ok: true, message: 'Administrator account created. You can now log in.' });
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const ua = c.req.header('User-Agent') ?? '';
  const user = await c.env.DB.prepare(`${USER_QUERY} WHERE u.email = ?`).bind((email ?? '').toLowerCase()).first<any>();

  const ok = user && user.active && (await verifyPassword(password ?? '', user.password_salt, user.password_hash));
  if (!ok) {
    await c.env.DB.prepare(
      `INSERT INTO login_history (user_id, email, success, ip_address, user_agent, device) VALUES (?, ?, 0, ?, ?, ?)`,
    )
      .bind(user?.id ?? null, email ?? '', clientIp(c), ua, deviceFromUserAgent(ua))
      .run();
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (user.mfa_enabled) {
    const now = Math.floor(Date.now() / 1000);
    const mfaToken = await signJwt(
      { sub: user.id, jti: randomHex(8), role: user.role_name, name: user.full_name, purpose: 'mfa', iat: now, exp: now + 300 },
      c.env.JWT_SECRET,
    );
    return c.json({ mfaRequired: true, mfaToken });
  }

  const { token, expiresInMinutes } = await issueAccessToken(c, user, false);
  return c.json({ token, expiresInMinutes, user: publicUser(user) });
});

auth.post('/mfa/verify', async (c) => {
  const { mfaToken, code } = await c.req.json<{ mfaToken: string; code: string }>();
  const payload = await verifyJwt(mfaToken ?? '', c.env.JWT_SECRET);
  if (!payload || payload.purpose !== 'mfa') return c.json({ error: 'Invalid or expired MFA token' }, 401);

  const user = await c.env.DB.prepare(`${USER_QUERY} WHERE u.id = ?`).bind(payload.sub).first<any>();
  if (!user || !user.active || !user.mfa_secret) return c.json({ error: 'Invalid account state' }, 401);

  if (!(await verifyTotp(user.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 401);
  }
  const { token, expiresInMinutes } = await issueAccessToken(c, user, true);
  return c.json({ token, expiresInMinutes, user: publicUser(user) });
});

// ---- authenticated endpoints ----
auth.use('/me', requireAuth);
auth.use('/me/*', requireAuth);
auth.use('/logout', requireAuth);
auth.use('/mfa/setup', requireAuth);
auth.use('/mfa/enable', requireAuth);
auth.use('/mfa/disable', requireAuth);

auth.get('/me', async (c) => {
  const u = c.get('user');
  const row = await c.env.DB.prepare(`SELECT mfa_enabled FROM users WHERE id = ?`).bind(u.id).first<any>();
  return c.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.roleName,
    permissions: u.permissions,
    officeLocation: u.officeLocation,
    mfaEnabled: !!row?.mfa_enabled,
  });
});

auth.get('/me/login-history', async (c) => {
  const u = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT success, mfa_used, ip_address, device, user_agent, created_at
     FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
  )
    .bind(u.id)
    .all();
  return c.json(rows.results);
});

auth.get('/me/sessions', async (c) => {
  const u = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT id, ip_address, device, created_at, expires_at, revoked,
            CASE WHEN id = ? THEN 1 ELSE 0 END AS current
     FROM auth_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(u.jwt.jti, u.id)
    .all();
  return c.json(rows.results);
});

auth.post('/me/password', async (c) => {
  const u = c.get('user');
  const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
  if (!newPassword || newPassword.length < 10) return c.json({ error: 'New password must be at least 10 characters' }, 400);
  const row = await c.env.DB.prepare(`SELECT password_hash, password_salt FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!(await verifyPassword(currentPassword ?? '', row.password_salt, row.password_hash))) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }
  const { hash, salt } = await hashPassword(newPassword);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(hash, salt, u.id)
    .run();
  await audit(c, 'user.password_change', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/mfa/setup', async (c) => {
  const u = c.get('user');
  const secret = generateTotpSecret();
  await c.env.DB.prepare(`UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?`).bind(secret, u.id).run();
  return c.json({ secret, otpauth: otpauthUrl(secret, u.email) });
});

auth.post('/mfa/enable', async (c) => {
  const u = c.get('user');
  const { code } = await c.req.json<{ code: string }>();
  const row = await c.env.DB.prepare(`SELECT mfa_secret FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!row?.mfa_secret || !(await verifyTotp(row.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
  await c.env.DB.prepare(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`).bind(u.id).run();
  await audit(c, 'user.mfa_enabled', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/mfa/disable', async (c) => {
  const u = c.get('user');
  const { code } = await c.req.json<{ code: string }>();
  const row = await c.env.DB.prepare(`SELECT mfa_secret FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!row?.mfa_secret || !(await verifyTotp(row.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
  await c.env.DB.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?`).bind(u.id).run();
  await audit(c, 'user.mfa_disabled', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  const u = c.get('user');
  await c.env.DB.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE id = ?`).bind(u.jwt.jti).run();
  await audit(c, 'user.logout', 'user', u.id);
  return c.json({ ok: true });
});

export default auth;
