import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware';
import type { AppContext } from '../types';

// Executive dashboard aggregations.

const dashboard = new Hono<AppContext>();
dashboard.use('*', requireAuth, requirePermission('dashboard.view'));

dashboard.get('/summary', async (c) => {
  const period = c.req.query('days') ?? '90';
  const days = Math.max(1, parseInt(period, 10) || 90);

  const [kpis, topTechs, topCrews, topPms, offices, systems, trend] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT lm.project_id) AS active_projects,
              COUNT(*) AS sessions,
              ROUND(COALESCE(SUM(lm.man_hours), 0), 1) AS man_hours,
              ROUND(COALESCE(SUM(lm.quantity * lm.estimate_hours_per_unit), 0), 1) AS earned_hours,
              ROUND(COALESCE(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0), 0) AS productivity_score
       FROM labor_metrics lm WHERE lm.work_date >= date('now', '-' || ? || ' days')`,
    )
      .bind(days)
      .first(),
    c.env.DB.prepare(
      `SELECT u.full_name AS label, COUNT(*) AS sessions, ROUND(SUM(lm.man_hours), 1) AS man_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm JOIN work_sessions ws ON ws.id = lm.session_id JOIN users u ON u.id = ws.created_by
       WHERE lm.work_date >= date('now', '-' || ? || ' days')
       GROUP BY ws.created_by HAVING sessions >= 2 ORDER BY productivity_score DESC LIMIT 10`,
    )
      .bind(days)
      .all(),
    c.env.DB.prepare(
      `SELECT lm.crew_size || '-person crew' AS label, COUNT(*) AS sessions,
              ROUND(SUM(lm.quantity) / SUM(lm.man_hours), 2) AS units_per_man_hour,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm WHERE lm.work_date >= date('now', '-' || ? || ' days')
       GROUP BY lm.crew_size ORDER BY productivity_score DESC LIMIT 10`,
    )
      .bind(days)
      .all(),
    c.env.DB.prepare(
      `SELECT u.full_name AS label, COUNT(DISTINCT lm.project_id) AS projects,
              ROUND(SUM(lm.man_hours), 1) AS man_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm JOIN projects p ON p.id = lm.project_id JOIN users u ON u.id = p.pm_user_id
       WHERE lm.work_date >= date('now', '-' || ? || ' days')
       GROUP BY p.pm_user_id ORDER BY productivity_score DESC LIMIT 10`,
    )
      .bind(days)
      .all(),
    c.env.DB.prepare(
      `SELECT lm.office_location AS label, COUNT(*) AS sessions, ROUND(SUM(lm.man_hours), 1) AS man_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm WHERE lm.work_date >= date('now', '-' || ? || ' days') AND lm.office_location != ''
       GROUP BY lm.office_location ORDER BY productivity_score DESC`,
    )
      .bind(days)
      .all(),
    c.env.DB.prepare(
      `SELECT s.name AS label, COUNT(*) AS sessions, ROUND(SUM(lm.man_hours), 1) AS man_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) - SUM(lm.man_hours), 1) AS labor_variance_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm JOIN systems s ON s.id = lm.system_id
       WHERE lm.work_date >= date('now', '-' || ? || ' days')
       GROUP BY lm.system_id ORDER BY productivity_score DESC`,
    )
      .bind(days)
      .all(),
    c.env.DB.prepare(
      `SELECT strftime('%Y-%W', lm.work_date) AS week,
              ROUND(SUM(lm.man_hours), 1) AS man_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit), 1) AS earned_hours,
              ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
       FROM labor_metrics lm WHERE lm.work_date >= date('now', '-' || ? || ' days')
       GROUP BY week ORDER BY week`,
    )
      .bind(days)
      .all(),
  ]);

  return c.json({
    periodDays: days,
    kpis,
    topTechnicians: topTechs.results,
    topCrews: topCrews.results,
    topProjectManagers: topPms.results,
    offices: offices.results,
    // productivity_score > 100 = beating estimates (profitable); < 100 = losing labor
    systems: systems.results,
    weeklyTrend: trend.results,
  });
});

export default dashboard;
