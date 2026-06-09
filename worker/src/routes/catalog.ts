import { Hono } from 'hono';
import { requireAuth, requirePermission, audit } from '../middleware';
import type { AppContext } from '../types';

const catalog = new Hono<AppContext>();
catalog.use('*', requireAuth);

/** Full catalog in one call for the field UI: systems with devices, task types, cable types. */
catalog.get('/', async (c) => {
  const [systems, devices, taskTypes, cableTypes] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM systems WHERE active = 1 ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(`SELECT * FROM devices WHERE active = 1 ORDER BY name`).all(),
    c.env.DB.prepare(`SELECT * FROM task_types WHERE active = 1 ORDER BY sort_order, name`).all(),
    c.env.DB.prepare(`SELECT * FROM cable_types WHERE active = 1 ORDER BY name`).all(),
  ]);
  return c.json({
    systems: systems.results.map((s: any) => ({
      ...s,
      devices: devices.results.filter((d: any) => d.system_id === s.id),
    })),
    taskTypes: taskTypes.results,
    cableTypes: cableTypes.results,
  });
});

// ---- admin management (unlimited systems and devices) ----
catalog.post('/systems', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.name) return c.json({ error: 'name is required' }, 400);
  const r = await c.env.DB.prepare(`INSERT INTO systems (name, sort_order) VALUES (?, ?)`)
    .bind(b.name, b.sortOrder ?? 99)
    .run();
  await audit(c, 'catalog.system_create', 'system', r.meta.last_row_id, { name: b.name });
  return c.json({ id: r.meta.last_row_id }, 201);
});

catalog.put('/systems/:id', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  await c.env.DB.prepare(`UPDATE systems SET name = ?, sort_order = ?, active = ? WHERE id = ?`)
    .bind(b.name, b.sortOrder ?? 99, b.active ? 1 : 0, c.req.param('id'))
    .run();
  await audit(c, 'catalog.system_update', 'system', c.req.param('id'));
  return c.json({ ok: true });
});

catalog.post('/devices', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.systemId || !b.name) return c.json({ error: 'systemId and name are required' }, 400);
  const r = await c.env.DB.prepare(
    `INSERT INTO devices (system_id, name, unit, estimate_hours_per_unit) VALUES (?, ?, ?, ?)`,
  )
    .bind(b.systemId, b.name, b.unit === 'feet' ? 'feet' : 'each', b.estimateHoursPerUnit ?? 0)
    .run();
  await audit(c, 'catalog.device_create', 'device', r.meta.last_row_id, { name: b.name });
  return c.json({ id: r.meta.last_row_id }, 201);
});

catalog.put('/devices/:id', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  await c.env.DB.prepare(
    `UPDATE devices SET name = ?, unit = ?, estimate_hours_per_unit = ?, active = ? WHERE id = ?`,
  )
    .bind(b.name, b.unit === 'feet' ? 'feet' : 'each', b.estimateHoursPerUnit ?? 0, b.active ? 1 : 0, c.req.param('id'))
    .run();
  await audit(c, 'catalog.device_update', 'device', c.req.param('id'));
  return c.json({ ok: true });
});

catalog.post('/task-types', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.name) return c.json({ error: 'name is required' }, 400);
  const r = await c.env.DB.prepare(`INSERT INTO task_types (name, sort_order) VALUES (?, ?)`)
    .bind(b.name, b.sortOrder ?? 99)
    .run();
  return c.json({ id: r.meta.last_row_id }, 201);
});

catalog.post('/cable-types', requirePermission('catalog.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.name) return c.json({ error: 'name is required' }, 400);
  const r = await c.env.DB.prepare(`INSERT INTO cable_types (name) VALUES (?)`).bind(b.name).run();
  return c.json({ id: r.meta.last_row_id }, 201);
});

export default catalog;
