import { Hono } from 'hono';
import { randomHex } from '../lib/crypto';
import { requireAuth, requirePermission, audit } from '../middleware';
import type { AppContext } from '../types';

const projects = new Hono<AppContext>();
projects.use('*', requireAuth);

const PROJECT_QUERY = `
  SELECT p.*, c.name AS customer_name, u.full_name AS pm_name
  FROM projects p
  JOIN customers c ON c.id = p.customer_id
  LEFT JOIN users u ON u.id = p.pm_user_id`;

projects.get('/', requirePermission('projects.view'), async (c) => {
  const status = c.req.query('status');
  const search = c.req.query('q');
  let sql = `${PROJECT_QUERY} WHERE 1=1`;
  const binds: unknown[] = [];
  if (status) {
    sql += ` AND p.status = ?`;
    binds.push(status);
  }
  if (search) {
    sql += ` AND (p.name LIKE ? OR p.project_number LIKE ? OR c.name LIKE ?)`;
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ` ORDER BY p.project_number`;
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json(rows.results);
});

/** QR code resolution: the QR encodes the project's qr_token. */
projects.get('/qr/:token', requirePermission('projects.view'), async (c) => {
  const row = await c.env.DB.prepare(`${PROJECT_QUERY} WHERE p.qr_token = ?`).bind(c.req.param('token')).first();
  if (!row) return c.json({ error: 'Project not found for QR code' }, 404);
  return c.json(row);
});

projects.get('/:id', requirePermission('projects.view'), async (c) => {
  const row = await c.env.DB.prepare(`${PROJECT_QUERY} WHERE p.id = ?`).bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Project not found' }, 404);
  return c.json(row);
});

/** Live labor status: budget vs spent vs earned, variance, productivity score. */
projects.get('/:id/labor', requirePermission('projects.view'), async (c) => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first<any>();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const agg = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(man_hours), 0) AS spent_hours,
       COALESCE(SUM(quantity * estimate_hours_per_unit), 0) AS earned_hours,
       COUNT(*) AS completed_sessions
     FROM labor_metrics WHERE project_id = ?`,
  )
    .bind(id)
    .first<any>();

  const spent = agg.spent_hours as number;
  const earned = agg.earned_hours as number;
  const budget = project.labor_budget_hours as number;
  // CPI-style productivity: earned / spent (>1 means beating the estimate)
  const productivity = spent > 0 ? earned / spent : 0;
  const pctComplete = budget > 0 ? Math.min(1, earned / budget) : 0;
  const estimatedAtCompletion = productivity > 0 && budget > 0 ? budget / productivity : spent;

  return c.json({
    projectId: project.id,
    laborBudgetHours: budget,
    spentLaborHours: round2(spent),
    earnedHours: round2(earned),
    remainingLaborHours: round2(Math.max(0, budget - spent)),
    estimatedCompletionHours: round2(estimatedAtCompletion),
    laborVarianceHours: round2(earned - spent),
    budgetVarianceHours: round2(budget - estimatedAtCompletion),
    productivityScore: Math.round(productivity * 100),
    percentComplete: Math.round(pctComplete * 100),
    completedSessions: agg.completed_sessions,
  });
});

projects.post('/', requirePermission('projects.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.projectNumber || !b.name || !b.customerId) {
    return c.json({ error: 'projectNumber, name, and customerId are required' }, 400);
  }
  const qrToken = randomHex(16);
  const result = await c.env.DB.prepare(
    `INSERT INTO projects (project_number, name, customer_id, site_address, market_segment, project_type,
                           office_location, labor_budget_hours, pm_user_id, qr_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      b.projectNumber,
      b.name,
      b.customerId,
      b.siteAddress ?? '',
      b.marketSegment ?? 'Commercial',
      b.projectType ?? 'Installation',
      b.officeLocation ?? '',
      b.laborBudgetHours ?? 0,
      b.pmUserId ?? null,
      qrToken,
    )
    .run();
  await audit(c, 'project.create', 'project', result.meta.last_row_id, { projectNumber: b.projectNumber });
  return c.json({ id: result.meta.last_row_id, qrToken }, 201);
});

projects.put('/:id', requirePermission('projects.manage'), async (c) => {
  const id = c.req.param('id');
  const b = await c.req.json<any>();
  await c.env.DB.prepare(
    `UPDATE projects SET name = ?, customer_id = ?, site_address = ?, market_segment = ?, project_type = ?,
       office_location = ?, status = ?, labor_budget_hours = ?, pm_user_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      b.name,
      b.customerId,
      b.siteAddress ?? '',
      b.marketSegment ?? 'Commercial',
      b.projectType ?? 'Installation',
      b.officeLocation ?? '',
      b.status ?? 'active',
      b.laborBudgetHours ?? 0,
      b.pmUserId ?? null,
      id,
    )
    .run();
  await audit(c, 'project.update', 'project', id);
  return c.json({ ok: true });
});

// ---- customers ----
projects.get('/customers/list', requirePermission('projects.view'), async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM customers WHERE active = 1 ORDER BY name`).all();
  return c.json(rows.results);
});

projects.post('/customers', requirePermission('customers.manage'), async (c) => {
  const b = await c.req.json<any>();
  if (!b.name) return c.json({ error: 'name is required' }, 400);
  const result = await c.env.DB.prepare(`INSERT INTO customers (name, market_segment) VALUES (?, ?)`)
    .bind(b.name, b.marketSegment ?? 'Commercial')
    .run();
  await audit(c, 'customer.create', 'customer', result.meta.last_row_id, { name: b.name });
  return c.json({ id: result.meta.last_row_id }, 201);
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default projects;
