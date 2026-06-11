import { Hono } from 'hono';
import { randomHex } from '../lib/crypto';
import { requireAuth, requirePermission, audit } from '../middleware';
import type { AppContext } from '../types';

const projects = new Hono<AppContext>();
projects.use('*', requireAuth);

const PROJECT_QUERY = `
  SELECT p.*, c.name AS customer_name, u.full_name AS pm_name,
         (SELECT GROUP_CONCAT(s.name, ', ')
          FROM project_systems ps JOIN systems s ON s.id = ps.system_id
          WHERE ps.project_id = p.id) AS systems_list
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
  const row = await c.env.DB.prepare(`${PROJECT_QUERY} WHERE p.id = ?`).bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Project not found' }, 404);
  const systems = await c.env.DB.prepare(
    `SELECT s.id, s.name FROM project_systems ps JOIN systems s ON s.id = ps.system_id WHERE ps.project_id = ? ORDER BY s.sort_order`,
  )
    .bind(row.id)
    .all();
  return c.json({ ...row, systems: systems.results });
});

/**
 * Bulk import projects (Excel/CSV upload parsed client-side).
 * Body: { rows: [{ projectNumber, name, customer, siteAddress, marketSegment,
 *                  projectType, officeLocation, laborBudgetHours, pmEmail, systems: string[] }] }
 * Idempotent: existing project numbers are skipped; missing customers are created.
 */
projects.post('/import', requirePermission('projects.manage'), async (c) => {
  const body = await c.req.json<{ rows: any[] }>();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return c.json({ error: 'No rows to import' }, 400);
  if (rows.length > 500) return c.json({ error: 'Maximum 500 rows per import' }, 400);

  const systemRows = (await c.env.DB.prepare(`SELECT id, name FROM systems WHERE active = 1`).all()).results as any[];
  const systemByName = new Map(systemRows.map((s) => [s.name.toLowerCase(), s.id]));
  const VALID_MARKETS = ['Healthcare', 'Education', 'Government', 'Military', 'Commercial', 'Industrial', 'Data Centers'];

  const results: any[] = [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // spreadsheet row (1-based + header)
    const report = (status: string, message: string, extra: Record<string, unknown> = {}) =>
      results.push({ row: rowNum, projectNumber: r.projectNumber ?? '', status, message, ...extra });

    try {
      const projectNumber = String(r.projectNumber ?? '').trim();
      const name = String(r.name ?? '').trim();
      const customerName = String(r.customer ?? '').trim();
      if (!projectNumber || !name || !customerName) {
        report('error', 'Project Number, Project Name, and Customer are required');
        continue;
      }

      const existing = await c.env.DB.prepare(`SELECT id FROM projects WHERE project_number = ?`).bind(projectNumber).first();
      if (existing) {
        skipped++;
        report('skipped', 'Project number already exists');
        continue;
      }

      const marketSegment = VALID_MARKETS.find((m) => m.toLowerCase() === String(r.marketSegment ?? '').trim().toLowerCase()) ?? 'Commercial';

      // find-or-create customer
      let customer = await c.env.DB.prepare(`SELECT id FROM customers WHERE name = ?`).bind(customerName).first<any>();
      if (!customer) {
        const ins = await c.env.DB.prepare(`INSERT INTO customers (name, market_segment) VALUES (?, ?)`)
          .bind(customerName, marketSegment)
          .run();
        customer = { id: ins.meta.last_row_id };
      }

      // optional PM match - accepts an email or a full name
      let pmUserId: number | null = null;
      let pmNote = '';
      const pmRaw = String(r.pmEmail ?? r.projectManager ?? '').trim();
      if (pmRaw) {
        const pm = pmRaw.includes('@')
          ? await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(pmRaw.toLowerCase()).first<any>()
          : await c.env.DB.prepare(`SELECT id FROM users WHERE full_name = ? COLLATE NOCASE`).bind(pmRaw).first<any>();
        if (pm) pmUserId = pm.id;
        else pmNote = ` (PM "${pmRaw}" not found - left unassigned)`;
      }

      // resolve systems
      const systemNames: string[] = Array.isArray(r.systems)
        ? r.systems
        : String(r.systems ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const systemIds: number[] = [];
      const unknownSystems: string[] = [];
      for (const sn of systemNames) {
        const id = systemByName.get(sn.toLowerCase());
        if (id) systemIds.push(id);
        else unknownSystems.push(sn);
      }
      if (unknownSystems.length) pmNote += ` (unknown systems ignored: ${unknownSystems.join(', ')})`;

      const qrToken = randomHex(16);
      const ins = await c.env.DB.prepare(
        `INSERT INTO projects (project_number, name, customer_id, site_address, market_segment, project_type,
                               office_location, labor_budget_hours, pm_user_id, superintendent_name, foreman_name, lead_name, qr_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          projectNumber,
          name,
          customer.id,
          String(r.siteAddress ?? '').trim(),
          marketSegment,
          String(r.projectType ?? '').trim() || 'Installation',
          String(r.officeLocation ?? '').trim(),
          Number(r.laborBudgetHours) || 0,
          pmUserId,
          String(r.superintendent ?? '').trim(),
          String(r.foreman ?? '').trim(),
          String(r.lead ?? '').trim(),
          qrToken,
        )
        .run();
      const projectId = ins.meta.last_row_id;
      for (const sid of systemIds) {
        await c.env.DB.prepare(`INSERT OR IGNORE INTO project_systems (project_id, system_id) VALUES (?, ?)`)
          .bind(projectId, sid)
          .run();
      }
      created++;
      report('created', `Imported${pmNote}`, { qrToken, systems: systemIds.length });
    } catch (e: any) {
      report('error', e.message ?? 'Unexpected error');
    }
  }

  await audit(c, 'project.import', 'project', '', { total: rows.length, created, skipped });
  return c.json({ total: rows.length, created, skipped, errors: results.filter((x) => x.status === 'error').length, results });
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

/**
 * Change project status. Marking a project 'complete' freezes it: it leaves
 * the field project list and no new work sessions can be started on it.
 */
projects.post('/:id/status', requirePermission('projects.manage'), async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json<{ status: string }>();
  const ALLOWED = ['active', 'complete', 'on_hold'];
  if (!ALLOWED.includes(status)) return c.json({ error: `status must be one of: ${ALLOWED.join(', ')}` }, 400);

  const project = await c.env.DB.prepare(`SELECT id, project_number, status FROM projects WHERE id = ?`).bind(id).first<any>();
  if (!project) return c.json({ error: 'Project not found' }, 404);
  if (project.status === 'archived') return c.json({ error: 'Archived projects cannot change status' }, 400);

  await c.env.DB.prepare(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`).bind(status, id).run();
  await audit(c, 'project.status', 'project', id, { projectNumber: project.project_number, from: project.status, to: status });
  return c.json({
    ok: true,
    status,
    message:
      status === 'complete'
        ? 'Project marked complete - it no longer appears in the field and no new work can be recorded on it.'
        : `Project is now ${status}.`,
  });
});

/**
 * Delete a project.
 * - No recorded work: removed permanently right away.
 * - Has work, still active: archived first (one click can't erase labor history).
 * - Already archived: permanently erased along with ALL its recorded history
 *   (sessions, events, reels, crew links, labor metrics, system scope).
 */
projects.delete('/:id', requirePermission('projects.manage'), async (c) => {
  const id = c.req.param('id');
  const project = await c.env.DB.prepare(`SELECT id, project_number, status FROM projects WHERE id = ?`).bind(id).first<any>();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const usage = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM work_sessions WHERE project_id = ?`).bind(id).first<any>();
  const hasWork = (usage?.n ?? 0) > 0;

  if (hasWork && project.status !== 'archived') {
    await c.env.DB.prepare(`UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    await audit(c, 'project.archive', 'project', id, { projectNumber: project.project_number, sessions: usage.n });
    return c.json({
      ok: true,
      action: 'archived',
      message: `Project has ${usage.n} recorded work session(s), so it was archived first - it no longer appears in the field. Delete it again to permanently erase it and its labor history.`,
    });
  }

  // Permanent removal - cascade through everything that references the project.
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM labor_metrics WHERE project_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM session_events WHERE session_id IN (SELECT id FROM work_sessions WHERE project_id = ?)`).bind(id),
    c.env.DB.prepare(`DELETE FROM session_technicians WHERE session_id IN (SELECT id FROM work_sessions WHERE project_id = ?)`).bind(id),
    c.env.DB.prepare(`DELETE FROM cable_reels WHERE session_id IN (SELECT id FROM work_sessions WHERE project_id = ?)`).bind(id),
    c.env.DB.prepare(`DELETE FROM work_sessions WHERE project_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM project_systems WHERE project_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(id),
  ]);
  await audit(c, 'project.delete', 'project', id, { projectNumber: project.project_number, erasedSessions: usage?.n ?? 0 });
  return c.json({
    ok: true,
    action: 'deleted',
    message: hasWork ? `Project and its ${usage.n} recorded work session(s) permanently deleted.` : 'Project deleted.',
  });
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
