import { Hono } from 'hono';
import { activeSecondsFromEvents, computeMetrics, cableFeetPulled, type SessionEvent } from '../lib/calculations';
import { requireAuth, requirePermission, audit } from '../middleware';
import { hasPermission } from '../lib/rbac';
import type { AppContext } from '../types';

const sessions = new Hono<AppContext>();
sessions.use('*', requireAuth);

async function loadSession(c: any, id: string) {
  return c.env.DB.prepare(`SELECT * FROM work_sessions WHERE id = ?`).bind(id).first();
}

function canTouch(c: any, session: any): boolean {
  const u = c.get('user');
  return session.created_by === u.id || hasPermission(u.permissions, 'sessions.view_all');
}

/**
 * Start a work session.
 * Device mode: { mode:'device', projectId, systemId, deviceId, taskTypeId, crewSize, technicianIds? }
 * Cable mode:  { mode:'cable', projectId, cableTypeId, taskTypeId, crewSize, reels:[{startingLength}], technicianIds? }
 */
sessions.post('/', requirePermission('sessions.create'), async (c) => {
  const u = c.get('user');
  const b = await c.req.json<any>();

  if (b.mode !== 'device' && b.mode !== 'cable') return c.json({ error: "mode must be 'device' or 'cable'" }, 400);
  if (!b.projectId || !b.taskTypeId) return c.json({ error: 'projectId and taskTypeId are required' }, 400);
  const crewSize = Math.max(1, parseInt(b.crewSize, 10) || 1);

  if (b.mode === 'device' && !b.deviceId) return c.json({ error: 'deviceId is required for device mode' }, 400);
  if (b.mode === 'cable') {
    if (!b.cableTypeId) return c.json({ error: 'cableTypeId is required for cable mode' }, 400);
    if (!Array.isArray(b.reels) || b.reels.length === 0) return c.json({ error: 'At least one reel is required' }, 400);
    for (const r of b.reels) {
      if (!(Number(r.startingLength) > 0)) return c.json({ error: 'Each reel needs a starting length > 0' }, 400);
    }
  }

  const project = await c.env.DB.prepare(`SELECT id, status FROM projects WHERE id = ?`).bind(b.projectId).first<any>();
  if (!project) return c.json({ error: 'Project not found' }, 404);
  if (project.status !== 'active') return c.json({ error: 'Project is not active' }, 400);

  const result = await c.env.DB.prepare(
    `INSERT INTO work_sessions (mode, project_id, system_id, device_id, cable_type_id, task_type_id, crew_size, created_by, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`,
  )
    .bind(
      b.mode,
      b.projectId,
      b.systemId ?? null,
      b.mode === 'device' ? b.deviceId : null,
      b.mode === 'cable' ? b.cableTypeId : null,
      b.taskTypeId,
      crewSize,
      u.id,
      b.notes ?? '',
    )
    .run();
  const sessionId = result.meta.last_row_id;

  const statements = [
    c.env.DB.prepare(`INSERT INTO session_events (session_id, event) VALUES (?, 'start')`).bind(sessionId),
    c.env.DB.prepare(`INSERT INTO session_technicians (session_id, user_id) VALUES (?, ?)`).bind(sessionId, u.id),
  ];
  for (const techId of (b.technicianIds ?? []).filter((t: number) => t !== u.id)) {
    statements.push(
      c.env.DB.prepare(`INSERT OR IGNORE INTO session_technicians (session_id, user_id) VALUES (?, ?)`).bind(sessionId, techId),
    );
  }
  if (b.mode === 'cable') {
    b.reels.forEach((r: any, i: number) => {
      statements.push(
        c.env.DB.prepare(`INSERT INTO cable_reels (session_id, reel_number, starting_length) VALUES (?, ?, ?)`).bind(
          sessionId,
          i + 1, // reels are auto-numbered
          Number(r.startingLength),
        ),
      );
    });
  }
  await c.env.DB.batch(statements);
  await audit(c, 'session.start', 'work_session', sessionId, { mode: b.mode, projectId: b.projectId, crewSize });
  return c.json({ id: sessionId, status: 'running' }, 201);
});

sessions.post('/:id/pause', async (c) => {
  const s = await loadSession(c, c.req.param('id'));
  if (!s || !canTouch(c, s)) return c.json({ error: 'Session not found' }, 404);
  if (s.status !== 'running') return c.json({ error: 'Session is not running' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO session_events (session_id, event) VALUES (?, 'pause')`).bind(s.id),
    c.env.DB.prepare(`UPDATE work_sessions SET status = 'paused' WHERE id = ?`).bind(s.id),
  ]);
  return c.json({ ok: true, status: 'paused' });
});

sessions.post('/:id/resume', async (c) => {
  const s = await loadSession(c, c.req.param('id'));
  if (!s || !canTouch(c, s)) return c.json({ error: 'Session not found' }, 404);
  if (s.status !== 'paused') return c.json({ error: 'Session is not paused' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO session_events (session_id, event) VALUES (?, 'resume')`).bind(s.id),
    c.env.DB.prepare(`UPDATE work_sessions SET status = 'running' WHERE id = ?`).bind(s.id),
  ]);
  return c.json({ ok: true, status: 'running' });
});

/**
 * Stop and complete a session, recording production:
 * Device mode: { quantity }  - total devices installed
 * Cable mode:  { reels: [{ reelNumber, remainingLength }] }
 * The finalized metrics row is the permanent labor-intelligence record.
 */
sessions.post('/:id/stop', async (c) => {
  const s = await loadSession(c, c.req.param('id'));
  if (!s || !canTouch(c, s)) return c.json({ error: 'Session not found' }, 404);
  if (s.status !== 'running' && s.status !== 'paused') return c.json({ error: 'Session already completed' }, 400);
  const b = await c.req.json<any>();

  let quantity: number;
  const reelStatements: D1PreparedStatement[] = [];
  if (s.mode === 'device') {
    quantity = Number(b.quantity);
    if (!(quantity > 0)) return c.json({ error: 'Total quantity installed must be greater than zero' }, 400);
  } else {
    const reels = (await c.env.DB.prepare(`SELECT * FROM cable_reels WHERE session_id = ? ORDER BY reel_number`).bind(s.id).all())
      .results as any[];
    const inputs = Array.isArray(b.reels) ? b.reels : [];
    const updated = reels.map((r) => {
      const input = inputs.find((i: any) => Number(i.reelNumber) === r.reel_number);
      if (!input || input.remainingLength === undefined || input.remainingLength === null) {
        throw Object.assign(new Error(`Remaining footage required for reel #${r.reel_number}`), { status: 400 });
      }
      return { ...r, remaining: Number(input.remainingLength) };
    });
    try {
      quantity = cableFeetPulled(updated.map((r) => ({ startingLength: r.starting_length, remainingLength: r.remaining })));
    } catch (e: any) {
      return c.json({ error: e.message }, 400);
    }
    if (!(quantity > 0)) return c.json({ error: 'No cable footage recorded' }, 400);
    for (const r of updated) {
      reelStatements.push(
        c.env.DB.prepare(`UPDATE cable_reels SET remaining_length = ? WHERE id = ?`).bind(r.remaining, r.id),
      );
    }
  }

  // Close the timer and compute active time from the event timeline.
  await c.env.DB.prepare(`INSERT INTO session_events (session_id, event) VALUES (?, 'stop')`).bind(s.id).run();
  const events = (await c.env.DB.prepare(`SELECT event, at FROM session_events WHERE session_id = ?`).bind(s.id).all())
    .results as unknown as SessionEvent[];
  const activeSeconds = activeSecondsFromEvents(events);
  const metrics = computeMetrics(activeSeconds, s.crew_size as number, quantity);

  const project = await c.env.DB.prepare(`SELECT * FROM projects WHERE id = ?`).bind(s.project_id).first<any>();
  let unit = 'each';
  let estimateRate = 0;
  if (s.mode === 'device') {
    const device = await c.env.DB.prepare(`SELECT unit, estimate_hours_per_unit FROM devices WHERE id = ?`)
      .bind(s.device_id)
      .first<any>();
    unit = device?.unit ?? 'each';
    estimateRate = device?.estimate_hours_per_unit ?? 0;
  } else {
    unit = 'feet';
    // Cable types map onto same-named structured-cabling devices for estimating rates when available.
    const match = await c.env.DB.prepare(
      `SELECT d.estimate_hours_per_unit FROM devices d JOIN cable_types ct ON ct.name = d.name WHERE ct.id = ? AND d.unit = 'feet' LIMIT 1`,
    )
      .bind(s.cable_type_id)
      .first<any>();
    estimateRate = match?.estimate_hours_per_unit ?? 0;
  }

  await c.env.DB.batch([
    ...reelStatements,
    c.env.DB.prepare(
      `UPDATE work_sessions SET status = 'completed', ended_at = datetime('now'), active_seconds = ?, quantity = ?, notes = ? WHERE id = ?`,
    ).bind(activeSeconds, quantity, b.notes ?? s.notes, s.id),
    c.env.DB.prepare(
      `INSERT INTO labor_metrics
         (session_id, project_id, customer_id, system_id, device_id, cable_type_id, task_type_id,
          market_segment, office_location, project_type, crew_size, unit, quantity,
          total_hours, man_hours, hours_per_unit, units_per_hour, units_per_man_hour,
          estimate_hours_per_unit, work_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'))`,
    ).bind(
      s.id,
      s.project_id,
      project.customer_id,
      s.system_id,
      s.device_id,
      s.cable_type_id,
      s.task_type_id,
      project.market_segment,
      project.office_location,
      project.project_type,
      s.crew_size,
      unit,
      quantity,
      metrics.totalHours,
      metrics.manHours,
      metrics.hoursPerUnit,
      metrics.unitsPerHour,
      metrics.unitsPerManHour,
      estimateRate,
    ),
  ]);

  await audit(c, 'session.complete', 'work_session', s.id, { quantity, activeSeconds, ...metrics });
  return c.json({ ok: true, status: 'completed', quantity, activeSeconds, metrics });
});

sessions.post('/:id/cancel', async (c) => {
  const s = await loadSession(c, c.req.param('id'));
  if (!s || !canTouch(c, s)) return c.json({ error: 'Session not found' }, 404);
  if (s.status !== 'running' && s.status !== 'paused') return c.json({ error: 'Session already completed' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO session_events (session_id, event) VALUES (?, 'stop')`).bind(s.id),
    c.env.DB.prepare(`UPDATE work_sessions SET status = 'cancelled', ended_at = datetime('now') WHERE id = ?`).bind(s.id),
  ]);
  await audit(c, 'session.cancel', 'work_session', s.id);
  return c.json({ ok: true, status: 'cancelled' });
});

/** Add a reel mid-session (cable mode). */
sessions.post('/:id/reels', async (c) => {
  const s = await loadSession(c, c.req.param('id'));
  if (!s || !canTouch(c, s)) return c.json({ error: 'Session not found' }, 404);
  if (s.mode !== 'cable') return c.json({ error: 'Not a cable session' }, 400);
  if (s.status !== 'running' && s.status !== 'paused') return c.json({ error: 'Session already completed' }, 400);
  const b = await c.req.json<any>();
  if (!(Number(b.startingLength) > 0)) return c.json({ error: 'startingLength must be > 0' }, 400);
  const max = await c.env.DB.prepare(`SELECT COALESCE(MAX(reel_number), 0) AS n FROM cable_reels WHERE session_id = ?`)
    .bind(s.id)
    .first<any>();
  const reelNumber = (max?.n ?? 0) + 1;
  await c.env.DB.prepare(`INSERT INTO cable_reels (session_id, reel_number, starting_length) VALUES (?, ?, ?)`)
    .bind(s.id, reelNumber, Number(b.startingLength))
    .run();
  return c.json({ reelNumber }, 201);
});

/** Current user's active (running/paused) sessions - lets a tech resume after app reload. */
sessions.get('/active', async (c) => {
  const u = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT ws.*, p.name AS project_name, p.project_number, sys.name AS system_name,
            d.name AS device_name, ct.name AS cable_type_name, tt.name AS task_type_name
     FROM work_sessions ws
     JOIN projects p ON p.id = ws.project_id
     LEFT JOIN systems sys ON sys.id = ws.system_id
     LEFT JOIN devices d ON d.id = ws.device_id
     LEFT JOIN cable_types ct ON ct.id = ws.cable_type_id
     JOIN task_types tt ON tt.id = ws.task_type_id
     WHERE ws.created_by = ? AND ws.status IN ('running','paused')
     ORDER BY ws.started_at DESC`,
  )
    .bind(u.id)
    .all();
  return c.json(rows.results);
});

sessions.get('/:id', async (c) => {
  const base: any = await loadSession(c, c.req.param('id'));
  if (!base || !canTouch(c, base)) return c.json({ error: 'Session not found' }, 404);
  const s: any = await c.env.DB.prepare(
    `SELECT ws.*, p.name AS project_name, p.project_number, sys.name AS system_name,
            d.name AS device_name, ct.name AS cable_type_name, tt.name AS task_type_name
     FROM work_sessions ws
     JOIN projects p ON p.id = ws.project_id
     LEFT JOIN systems sys ON sys.id = ws.system_id
     LEFT JOIN devices d ON d.id = ws.device_id
     LEFT JOIN cable_types ct ON ct.id = ws.cable_type_id
     JOIN task_types tt ON tt.id = ws.task_type_id
     WHERE ws.id = ?`,
  )
    .bind(base.id)
    .first();
  const [events, reels, techs] = await Promise.all([
    c.env.DB.prepare(`SELECT event, at FROM session_events WHERE session_id = ? ORDER BY id`).bind(s.id).all(),
    c.env.DB.prepare(`SELECT * FROM cable_reels WHERE session_id = ? ORDER BY reel_number`).bind(s.id).all(),
    c.env.DB.prepare(
      `SELECT u.id, u.full_name FROM session_technicians st JOIN users u ON u.id = st.user_id WHERE st.session_id = ?`,
    )
      .bind(s.id)
      .all(),
  ]);
  const activeSeconds =
    s.status === 'completed' || s.status === 'cancelled'
      ? s.active_seconds
      : activeSecondsFromEvents(events.results as unknown as SessionEvent[]);
  return c.json({ ...s, events: events.results, reels: reels.results, technicians: techs.results, liveActiveSeconds: activeSeconds });
});

/** Session history (own, or all with sessions.view_all). */
sessions.get('/', async (c) => {
  const u = c.get('user');
  const viewAll = hasPermission(u.permissions, 'sessions.view_all');
  const projectId = c.req.query('projectId');
  let sql = `
    SELECT ws.*, p.name AS project_name, p.project_number, sys.name AS system_name,
           d.name AS device_name, ct.name AS cable_type_name, tt.name AS task_type_name,
           u.full_name AS created_by_name,
           lm.man_hours, lm.hours_per_unit, lm.units_per_hour, lm.units_per_man_hour
    FROM work_sessions ws
    JOIN projects p ON p.id = ws.project_id
    LEFT JOIN systems sys ON sys.id = ws.system_id
    LEFT JOIN devices d ON d.id = ws.device_id
    LEFT JOIN cable_types ct ON ct.id = ws.cable_type_id
    JOIN task_types tt ON tt.id = ws.task_type_id
    JOIN users u ON u.id = ws.created_by
    LEFT JOIN labor_metrics lm ON lm.session_id = ws.id
    WHERE 1=1`;
  const binds: unknown[] = [];
  if (!viewAll) {
    sql += ` AND ws.created_by = ?`;
    binds.push(u.id);
  }
  if (projectId) {
    sql += ` AND ws.project_id = ?`;
    binds.push(projectId);
  }
  sql += ` ORDER BY ws.started_at DESC LIMIT 200`;
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json(rows.results);
});

export default sessions;
