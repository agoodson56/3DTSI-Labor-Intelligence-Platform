import { Hono } from 'hono';
import { requireAuth, requirePermission } from '../middleware';
import type { AppContext } from '../types';

// Labor Intelligence Engine: every completed session feeds labor_metrics;
// these endpoints aggregate it into learned production rates and
// estimating recommendations.

const intelligence = new Hono<AppContext>();
intelligence.use('*', requireAuth, requirePermission('intelligence.view'));

const MIN_SAMPLES_FOR_CONFIDENCE = 5;

function confidence(samples: number): 'low' | 'medium' | 'high' {
  if (samples >= 20) return 'high';
  if (samples >= MIN_SAMPLES_FOR_CONFIDENCE) return 'medium';
  return 'low';
}

/** Learned production rates per device (the answer to "how long does a horn strobe actually take?"). */
intelligence.get('/rates/devices', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT d.id AS device_id, d.name AS device, s.name AS system, d.unit,
            d.estimate_hours_per_unit AS estimate_rate,
            COUNT(lm.id) AS samples,
            SUM(lm.quantity) AS total_units,
            SUM(lm.man_hours) AS total_man_hours,
            ROUND(SUM(lm.man_hours) / SUM(lm.quantity), 4) AS actual_hours_per_unit,
            ROUND(SUM(lm.quantity) / SUM(lm.total_hours), 2) AS units_per_hour,
            ROUND(SUM(lm.quantity) / SUM(lm.man_hours), 2) AS units_per_man_hour
     FROM labor_metrics lm
     JOIN devices d ON d.id = lm.device_id
     JOIN systems s ON s.id = d.system_id
     GROUP BY d.id ORDER BY s.name, d.name`,
  ).all();
  return c.json(
    (rows.results as any[]).map((r) => ({
      ...r,
      confidence: confidence(r.samples),
      variance_pct:
        r.estimate_rate > 0 ? Math.round(((r.actual_hours_per_unit - r.estimate_rate) / r.estimate_rate) * 100) : null,
    })),
  );
});

/** Learned cable-pull rates per cable type (feet/hour, feet/man-hour). */
intelligence.get('/rates/cable', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT ct.id AS cable_type_id, ct.name AS cable_type,
            COUNT(lm.id) AS samples,
            SUM(lm.quantity) AS total_feet,
            SUM(lm.man_hours) AS total_man_hours,
            ROUND(SUM(lm.quantity) / SUM(lm.total_hours), 1) AS feet_per_hour,
            ROUND(SUM(lm.quantity) / SUM(lm.man_hours), 1) AS feet_per_man_hour,
            ROUND(SUM(lm.man_hours) / SUM(lm.quantity), 4) AS hours_per_foot
     FROM labor_metrics lm
     JOIN cable_types ct ON ct.id = lm.cable_type_id
     GROUP BY ct.id ORDER BY ct.name`,
  ).all();
  return c.json((rows.results as any[]).map((r) => ({ ...r, confidence: confidence(r.samples) })));
});

/** Crew-size efficiency: which crew sizes produce the best units-per-man-hour. */
intelligence.get('/rates/crew-size', async (c) => {
  const deviceId = c.req.query('deviceId');
  const cableTypeId = c.req.query('cableTypeId');
  let where = '1=1';
  const binds: unknown[] = [];
  if (deviceId) {
    where += ' AND lm.device_id = ?';
    binds.push(deviceId);
  }
  if (cableTypeId) {
    where += ' AND lm.cable_type_id = ?';
    binds.push(cableTypeId);
  }
  const rows = await c.env.DB.prepare(
    `SELECT lm.crew_size,
            COUNT(*) AS samples,
            SUM(lm.quantity) AS total_units,
            ROUND(SUM(lm.quantity) / SUM(lm.man_hours), 2) AS units_per_man_hour,
            ROUND(SUM(lm.quantity) / SUM(lm.total_hours), 2) AS units_per_hour
     FROM labor_metrics lm WHERE ${where}
     GROUP BY lm.crew_size ORDER BY lm.crew_size`,
  )
    .bind(...binds)
    .all();
  return c.json((rows.results as any[]).map((r) => ({ ...r, confidence: confidence(r.samples) })));
});

/** Production rates grouped by an arbitrary dimension. */
intelligence.get('/rates/by/:dimension', async (c) => {
  const dimension = c.req.param('dimension');
  const allowed: Record<string, string> = {
    technician: `u.full_name`,
    customer: `cust.name`,
    market: `lm.market_segment`,
    office: `lm.office_location`,
    'project-type': `lm.project_type`,
    system: `sys.name`,
  };
  const groupExpr = allowed[dimension];
  if (!groupExpr) return c.json({ error: `Unknown dimension. Use one of: ${Object.keys(allowed).join(', ')}` }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT ${groupExpr} AS label,
            COUNT(*) AS samples,
            SUM(lm.quantity) AS total_units,
            ROUND(SUM(lm.man_hours), 1) AS total_man_hours,
            ROUND(SUM(lm.quantity) / SUM(lm.man_hours), 2) AS units_per_man_hour,
            ROUND(SUM(lm.quantity * lm.estimate_hours_per_unit) / NULLIF(SUM(lm.man_hours), 0) * 100, 0) AS productivity_score
     FROM labor_metrics lm
     JOIN work_sessions ws ON ws.id = lm.session_id
     JOIN users u ON u.id = ws.created_by
     JOIN customers cust ON cust.id = lm.customer_id
     LEFT JOIN systems sys ON sys.id = lm.system_id
     GROUP BY label HAVING label IS NOT NULL AND label != ''
     ORDER BY productivity_score DESC`,
  ).all();
  return c.json((rows.results as any[]).map((r) => ({ ...r, confidence: confidence(r.samples) })));
});

/**
 * Estimating recommendation for a device: learned rate, recommended crew size,
 * and expected duration for a given quantity. This is the integration point
 * for SmartPlans2 / MyKyah Estimating / 3D Change Order.
 */
intelligence.get('/recommendations/estimate', async (c) => {
  const deviceId = c.req.query('deviceId');
  const quantity = Number(c.req.query('quantity') ?? 1);
  if (!deviceId) return c.json({ error: 'deviceId query parameter is required' }, 400);

  const device = await c.env.DB.prepare(
    `SELECT d.*, s.name AS system_name FROM devices d JOIN systems s ON s.id = d.system_id WHERE d.id = ?`,
  )
    .bind(deviceId)
    .first<any>();
  if (!device) return c.json({ error: 'Device not found' }, 404);

  const actual = await c.env.DB.prepare(
    `SELECT COUNT(*) AS samples, SUM(quantity) AS units, SUM(man_hours) AS man_hours
     FROM labor_metrics WHERE device_id = ?`,
  )
    .bind(deviceId)
    .first<any>();

  const bestCrew = await c.env.DB.prepare(
    `SELECT crew_size, SUM(quantity) / SUM(man_hours) AS upmh, COUNT(*) AS samples
     FROM labor_metrics WHERE device_id = ?
     GROUP BY crew_size HAVING samples >= 2 ORDER BY upmh DESC LIMIT 1`,
  )
    .bind(deviceId)
    .first<any>();

  const samples = actual?.samples ?? 0;
  const learnedRate = samples > 0 ? actual.man_hours / actual.units : null;
  const rate = learnedRate ?? device.estimate_hours_per_unit;
  const recommendedCrew = bestCrew?.crew_size ?? 2;
  const laborHours = rate * quantity;

  return c.json({
    device: device.name,
    system: device.system_name,
    unit: device.unit,
    quantity,
    currentEstimateRate: device.estimate_hours_per_unit,
    learnedRate: learnedRate ? Math.round(learnedRate * 10000) / 10000 : null,
    samples,
    confidence: confidence(samples),
    recommendation: {
      laborHours: Math.round(laborHours * 100) / 100,
      crewSize: recommendedCrew,
      productionRate: rate > 0 ? Math.round((1 / rate) * 100) / 100 : null, // units per man-hour
      expectedDurationHours: Math.round((laborHours / recommendedCrew) * 100) / 100,
    },
  });
});

/**
 * AI analytics: rule-based findings over the learned data - estimate-vs-actual
 * gaps, labor overruns, productivity outliers, training opportunities.
 */
intelligence.get('/insights', async (c) => {
  const insights: Array<{ type: string; severity: 'info' | 'opportunity' | 'warning'; message: string; data?: unknown }> = [];

  // 1. Estimating database vs reality
  const rateGaps = (
    await c.env.DB.prepare(
      `SELECT d.name, d.estimate_hours_per_unit AS est, COUNT(*) AS samples,
              SUM(lm.man_hours) / SUM(lm.quantity) AS actual
       FROM labor_metrics lm JOIN devices d ON d.id = lm.device_id
       WHERE d.estimate_hours_per_unit > 0
       GROUP BY d.id HAVING samples >= ${MIN_SAMPLES_FOR_CONFIDENCE}`,
    ).all()
  ).results as any[];

  for (const g of rateGaps) {
    const pct = Math.round(((g.est - g.actual) / g.est) * 100);
    if (pct >= 15) {
      insights.push({
        type: 'estimate_reduction',
        severity: 'opportunity',
        message: `${g.name} installations average ${round2(g.actual)} hours each. Current estimating database uses ${round2(g.est)} hours. Labor estimate can be reduced by ${pct}%.`,
        data: { device: g.name, actual: round2(g.actual), estimate: g.est, samples: g.samples },
      });
    } else if (pct <= -15) {
      insights.push({
        type: 'labor_overrun',
        severity: 'warning',
        message: `${g.name} installations average ${round2(g.actual)} hours each but are estimated at ${round2(g.est)} hours - actuals exceed estimates by ${-pct}%. Raise the estimating rate or investigate installation practices.`,
        data: { device: g.name, actual: round2(g.actual), estimate: g.est, samples: g.samples },
      });
    }
  }

  // 2. Projects trending over labor budget
  const overruns = (
    await c.env.DB.prepare(
      `SELECT p.project_number, p.name, p.labor_budget_hours AS budget,
              SUM(lm.man_hours) AS spent, SUM(lm.quantity * lm.estimate_hours_per_unit) AS earned
       FROM labor_metrics lm JOIN projects p ON p.id = lm.project_id
       WHERE p.status = 'active' AND p.labor_budget_hours > 0
       GROUP BY p.id HAVING spent > earned * 1.1`,
    ).all()
  ).results as any[];
  for (const o of overruns) {
    insights.push({
      type: 'project_overrun',
      severity: 'warning',
      message: `Project ${o.project_number} (${o.name}) has spent ${round2(o.spent)} man-hours but earned only ${round2(o.earned)} hours of estimated value - labor is running ${Math.round((o.spent / Math.max(o.earned, 0.01) - 1) * 100)}% over earned value.`,
      data: o,
    });
  }

  // 3. Optimal crew sizes
  const crewWins = (
    await c.env.DB.prepare(
      `SELECT d.name, lm.crew_size, SUM(lm.quantity) / SUM(lm.man_hours) AS upmh, COUNT(*) AS samples
       FROM labor_metrics lm JOIN devices d ON d.id = lm.device_id
       GROUP BY lm.device_id, lm.crew_size HAVING samples >= 3`,
    ).all()
  ).results as any[];
  const byDevice = new Map<string, any[]>();
  for (const r of crewWins) {
    if (!byDevice.has(r.name)) byDevice.set(r.name, []);
    byDevice.get(r.name)!.push(r);
  }
  for (const [device, rows] of byDevice) {
    if (rows.length < 2) continue;
    const best = rows.reduce((a, b) => (a.upmh > b.upmh ? a : b));
    const worst = rows.reduce((a, b) => (a.upmh < b.upmh ? a : b));
    if (best.upmh > worst.upmh * 1.25) {
      insights.push({
        type: 'crew_size',
        severity: 'opportunity',
        message: `${device}: a ${best.crew_size}-person crew produces ${round2(best.upmh)} units per man-hour vs ${round2(worst.upmh)} for a ${worst.crew_size}-person crew. Staff ${device} work with ${best.crew_size}-person crews.`,
        data: { device, best, worst },
      });
    }
  }

  // 4. Technicians significantly below the device average (training opportunities)
  const techGaps = (
    await c.env.DB.prepare(
      `WITH device_avg AS (
         SELECT device_id, SUM(quantity) / SUM(man_hours) AS avg_upmh
         FROM labor_metrics WHERE device_id IS NOT NULL GROUP BY device_id HAVING COUNT(*) >= ${MIN_SAMPLES_FOR_CONFIDENCE}
       )
       SELECT u.full_name, d.name AS device, COUNT(*) AS samples,
              SUM(lm.quantity) / SUM(lm.man_hours) AS tech_upmh, da.avg_upmh
       FROM labor_metrics lm
       JOIN work_sessions ws ON ws.id = lm.session_id
       JOIN users u ON u.id = ws.created_by
       JOIN devices d ON d.id = lm.device_id
       JOIN device_avg da ON da.device_id = lm.device_id
       GROUP BY ws.created_by, lm.device_id
       HAVING samples >= 3 AND tech_upmh < da.avg_upmh * 0.7`,
    ).all()
  ).results as any[];
  for (const t of techGaps) {
    insights.push({
      type: 'training_opportunity',
      severity: 'info',
      message: `${t.full_name} averages ${round2(t.tech_upmh)} ${t.device} per man-hour vs a company average of ${round2(t.avg_upmh)}. Consider pairing with a top performer or targeted training.`,
      data: t,
    });
  }

  return c.json({ generatedAt: new Date().toISOString(), count: insights.length, insights });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default intelligence;
