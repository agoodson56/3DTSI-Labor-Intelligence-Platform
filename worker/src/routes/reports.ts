import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware';
import type { AppContext } from '../types';

// Reporting: daily/weekly/monthly/quarterly/annual + project/technician/crew/customer
// scopes. Returns JSON for the UI or CSV for export (Excel opens CSV natively;
// the web app also exports XLSX and print-to-PDF client-side).

const reports = new Hono<AppContext>();
reports.use('*', requireAuth, requirePermission('reports.view'));

const PERIODS: Record<string, string> = {
  daily: '-1 days',
  weekly: '-7 days',
  monthly: '-1 months',
  quarterly: '-3 months',
  annual: '-12 months',
};

reports.get('/', async (c) => {
  const period = c.req.query('period') ?? 'weekly';
  const groupBy = c.req.query('groupBy') ?? 'project';
  const format = c.req.query('format') ?? 'json';
  const projectId = c.req.query('projectId');

  const offset = PERIODS[period];
  if (!offset) return c.json({ error: `period must be one of: ${Object.keys(PERIODS).join(', ')}` }, 400);

  const groups: Record<string, { label: string; join: string }> = {
    project: { label: `p.project_number || ' - ' || p.name`, join: '' },
    technician: { label: `tech.full_name`, join: '' },
    crew: { label: `lm.crew_size || '-person crew'`, join: '' },
    customer: { label: `cust.name`, join: '' },
    system: { label: `COALESCE(sys.name, 'Cable')`, join: '' },
    device: { label: `COALESCE(d.name, ct.name)`, join: '' },
    market: { label: `lm.market_segment`, join: '' },
  };
  const group = groups[groupBy];
  if (!group) return c.json({ error: `groupBy must be one of: ${Object.keys(groups).join(', ')}` }, 400);

  let where = `lm.work_date >= date('now', ?)`;
  const binds: unknown[] = [offset];
  if (projectId) {
    where += ` AND lm.project_id = ?`;
    binds.push(projectId);
  }

  const rows = await c.env.DB.prepare(
    `SELECT ${group.label} AS label,
            COUNT(*) AS sessions,
            ROUND(SUM(lm.quantity), 1) AS total_units,
            ROUND(SUM(lm.total_hours), 2) AS clock_hours,
            ROUND(SUM(lm.man_hours), 2) AS man_hours,
            ROUND(SUM(lm.quantity) / NULLIF(SUM(lm.man_hours), 0), 2) AS units_per_man_hour,
            ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit), 2) AS earned_hours,
            ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) - SUM(lm.man_hours), 2) AS labor_variance_hours,
            ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
     FROM labor_metrics lm
     JOIN projects p ON p.id = lm.project_id
     JOIN customers cust ON cust.id = lm.customer_id
     JOIN work_sessions ws ON ws.id = lm.session_id
     JOIN users tech ON tech.id = ws.created_by
     LEFT JOIN systems sys ON sys.id = lm.system_id
     LEFT JOIN devices d ON d.id = lm.device_id
     LEFT JOIN cable_types ct ON ct.id = lm.cable_type_id
     WHERE ${where}
     GROUP BY label ORDER BY man_hours DESC`,
  )
    .bind(...binds)
    .all();

  if (format === 'csv') {
    const header = 'Label,Sessions,Total Units,Clock Hours,Man Hours,Units Per Man Hour,Earned Hours,Labor Variance Hours,Productivity Score';
    const lines = (rows.results as any[]).map((r) =>
      [csvEscape(r.label), r.sessions, r.total_units, r.clock_hours, r.man_hours, r.units_per_man_hour, r.earned_hours, r.labor_variance_hours, r.productivity_score].join(','),
    );
    return new Response([header, ...lines].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lip-report-${period}-${groupBy}.csv"`,
      },
    });
  }

  return c.json({ period, groupBy, rows: rows.results });
});

/** Raw session detail export for a period (full audit-grade data). */
reports.get('/detail', async (c) => {
  const period = c.req.query('period') ?? 'weekly';
  const format = c.req.query('format') ?? 'json';
  const offset = PERIODS[period];
  if (!offset) return c.json({ error: `period must be one of: ${Object.keys(PERIODS).join(', ')}` }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT lm.work_date, p.project_number, p.name AS project, cust.name AS customer,
            COALESCE(sys.name, 'Cable') AS system, COALESCE(d.name, ct.name) AS item,
            tt.name AS task_type, tech.full_name AS technician, lm.crew_size,
            lm.quantity, lm.unit, lm.total_hours, lm.man_hours,
            lm.hours_per_unit, lm.units_per_hour, lm.units_per_man_hour
     FROM labor_metrics lm
     JOIN projects p ON p.id = lm.project_id
     JOIN customers cust ON cust.id = lm.customer_id
     JOIN work_sessions ws ON ws.id = lm.session_id
     JOIN users tech ON tech.id = ws.created_by
     JOIN task_types tt ON tt.id = lm.task_type_id
     LEFT JOIN systems sys ON sys.id = lm.system_id
     LEFT JOIN devices d ON d.id = lm.device_id
     LEFT JOIN cable_types ct ON ct.id = lm.cable_type_id
     WHERE lm.work_date >= date('now', ?)
     ORDER BY lm.work_date DESC`,
  )
    .bind(offset)
    .all();

  if (format === 'csv') {
    const cols = Object.keys((rows.results[0] as object) ?? { no_data: '' });
    const lines = (rows.results as any[]).map((r) => cols.map((k) => csvEscape(r[k])).join(','));
    return new Response([cols.join(','), ...lines].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lip-detail-${period}.csv"`,
      },
    });
  }
  return c.json({ period, rows: rows.results });
});

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default reports;
