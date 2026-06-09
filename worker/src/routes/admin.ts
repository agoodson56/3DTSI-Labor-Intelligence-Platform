import { Hono } from 'hono';
import { hashPassword } from '../lib/crypto';
import { ALL_PERMISSIONS } from '../lib/rbac';
import { requireAuth, requirePermission, audit } from '../middleware';
import type { AppContext } from '../types';

const admin = new Hono<AppContext>();
admin.use('*', requireAuth);

// ---- users ----
admin.get('/users', requirePermission('users.view'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.full_name, u.office_location, u.phone, u.active, u.mfa_enabled,
            u.created_at, r.name AS role, r.id AS role_id
     FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.full_name`,
  ).all();
  return c.json(rows.results);
});

admin.post('/users', requirePermission('users.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.email || !b.fullName || !b.roleId || !b.password || b.password.length < 10) {
    return c.json({ error: 'email, fullName, roleId, and a password of at least 10 characters are required' }, 400);
  }
  const exists = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(b.email.toLowerCase()).first();
  if (exists) return c.json({ error: 'A user with that email already exists' }, 409);

  const { hash, salt } = await hashPassword(b.password);
  const r = await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, password_salt, full_name, role_id, office_location, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(b.email.toLowerCase(), hash, salt, b.fullName, b.roleId, b.officeLocation ?? '', b.phone ?? '')
    .run();
  await audit(c, 'user.create', 'user', r.meta.last_row_id, { email: b.email });
  return c.json({ id: r.meta.last_row_id }, 201);
});

admin.put('/users/:id', requirePermission('users.manage'), async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  await c.env.DB.prepare(
    `UPDATE users SET full_name = ?, role_id = ?, office_location = ?, phone = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(b.fullName, b.roleId, b.officeLocation ?? '', b.phone ?? '', b.active ? 1 : 0, id)
    .run();
  if (b.password && b.password.length >= 10) {
    const { hash, salt } = await hashPassword(b.password);
    await c.env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`).bind(hash, salt, id).run();
  }
  if (b.active === false) {
    await c.env.DB.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?`).bind(id).run();
  }
  await audit(c, 'user.update', 'user', id);
  return c.json({ ok: true });
});

// ---- roles (configurable permissions) ----
admin.get('/roles', requirePermission('users.view'), async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM roles ORDER BY id`).all();
  return c.json({
    roles: (rows.results as any[]).map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })),
    availablePermissions: ALL_PERMISSIONS,
  });
});

admin.post('/roles', requirePermission('roles.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.name || !Array.isArray(b.permissions)) return c.json({ error: 'name and permissions[] are required' }, 400);
  const r = await c.env.DB.prepare(`INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)`)
    .bind(b.name, b.description ?? '', JSON.stringify(b.permissions))
    .run();
  await audit(c, 'role.create', 'role', r.meta.last_row_id, { name: b.name });
  return c.json({ id: r.meta.last_row_id }, 201);
});

admin.put('/roles/:id', requirePermission('roles.manage'), async (c) => {
  const b = await c.req.json<any>();
  await c.env.DB.prepare(`UPDATE roles SET description = ?, permissions = ? WHERE id = ?`)
    .bind(b.description ?? '', JSON.stringify(b.permissions ?? []), c.req.param('id'))
    .run();
  await audit(c, 'role.update', 'role', c.req.param('id'));
  return c.json({ ok: true });
});

// ---- audit log ----
admin.get('/audit', requirePermission('audit.view'), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.full_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 500`,
  ).all();
  return c.json(rows.results);
});

export default admin;
