// End-to-end API integration tests: bootstrap -> auth -> projects -> device
// and cable work sessions -> labor metrics -> intelligence -> dashboards ->
// reports -> RBAC enforcement. Runs the real Hono app against an in-memory
// SQLite database emulating D1.

import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index';
import { createTestDb } from './d1shim';

const env: any = {
  DB: createTestDb(),
  FILES: {},
  JWT_SECRET: 'integration-test-secret-integration-test-secret-0123456789abcdef',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  SESSION_TIMEOUT_MINUTES: '480',
};

let adminToken = '';
let techToken = '';
let projectId = 0;
let qrToken = '';

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON (csv) */
  }
  return { status: res.status, data };
}

describe('API integration', () => {
  beforeAll(async () => {
    // bootstrap admin
    const boot = await call('POST', '/api/auth/bootstrap', {
      email: 'admin@3dtsi.com',
      password: 'AdminPassword#1',
      fullName: 'System Admin',
    });
    expect(boot.status).toBe(200);

    const login = await call('POST', '/api/auth/login', { email: 'admin@3dtsi.com', password: 'AdminPassword#1' });
    expect(login.status).toBe(200);
    adminToken = login.data.token;
  });

  it('health endpoint responds', async () => {
    const r = await call('GET', '/api/health');
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it('rejects a second bootstrap', async () => {
    const r = await call('POST', '/api/auth/bootstrap', { email: 'x@x.com', password: 'aaaaaaaaaaaa', fullName: 'X' });
    expect(r.status).toBe(409);
  });

  it('rejects bad credentials and records login history', async () => {
    const r = await call('POST', '/api/auth/login', { email: 'admin@3dtsi.com', password: 'wrong-password' });
    expect(r.status).toBe(401);
    const hist = await call('GET', '/api/auth/me/login-history', undefined, adminToken);
    expect(hist.data.some((h: any) => h.success === 0)).toBe(true);
  });

  it('creates a technician user with role-limited permissions', async () => {
    const roles = await call('GET', '/api/admin/roles', undefined, adminToken);
    const techRole = roles.data.roles.find((r: any) => r.name === 'Technician');
    const created = await call(
      'POST',
      '/api/admin/users',
      { email: 'tech@3dtsi.com', fullName: 'Field Tech', password: 'TechPassword#1', roleId: techRole.id, officeLocation: 'Nashville' },
      adminToken,
    );
    expect(created.status).toBe(201);

    const login = await call('POST', '/api/auth/login', { email: 'tech@3dtsi.com', password: 'TechPassword#1' });
    expect(login.status).toBe(200);
    techToken = login.data.token;
    expect(login.data.user.role).toBe('Technician');
  });

  it('enforces RBAC: technician cannot view dashboards or manage users', async () => {
    expect((await call('GET', '/api/dashboard/summary', undefined, techToken)).status).toBe(403);
    expect((await call('POST', '/api/admin/users', { email: 'a@a.com' }, techToken)).status).toBe(403);
    expect((await call('GET', '/api/dashboard/summary', undefined, adminToken)).status).toBe(200);
  });

  it('creates customer and project with QR token', async () => {
    const cust = await call('POST', '/api/projects/customers', { name: 'Metro General Hospital', marketSegment: 'Healthcare' }, adminToken);
    expect(cust.status).toBe(201);
    const proj = await call(
      'POST',
      '/api/projects',
      {
        projectNumber: 'P-2026-001',
        name: 'East Tower Fire Alarm Retrofit',
        customerId: cust.data.id,
        siteAddress: '100 Hospital Way, Nashville TN',
        marketSegment: 'Healthcare',
        projectType: 'Retrofit',
        officeLocation: 'Nashville',
        laborBudgetHours: 500,
      },
      adminToken,
    );
    expect(proj.status).toBe(201);
    projectId = proj.data.id;
    qrToken = proj.data.qrToken;
  });

  it('resolves a project from its QR token', async () => {
    const r = await call('GET', `/api/projects/qr/${qrToken}`, undefined, techToken);
    expect(r.status).toBe(200);
    expect(r.data.project_number).toBe('P-2026-001');
    expect(r.data.customer_name).toBe('Metro General Hospital');
  });

  it('runs a device-installation session: start -> pause -> resume -> stop(47 horn strobes)', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const fireAlarm = catalog.data.systems.find((s: any) => s.name === 'Fire Alarm');
    const hornStrobe = fireAlarm.devices.find((d: any) => d.name === 'Horn/Strobes');
    const install = catalog.data.taskTypes.find((t: any) => t.name === 'Device Installation');

    const start = await call(
      'POST',
      '/api/sessions',
      { mode: 'device', projectId, systemId: fireAlarm.id, deviceId: hornStrobe.id, taskTypeId: install.id, crewSize: 2 },
      techToken,
    );
    expect(start.status).toBe(201);
    const sid = start.data.id;

    expect((await call('POST', `/api/sessions/${sid}/pause`, {}, techToken)).status).toBe(200);
    expect((await call('POST', `/api/sessions/${sid}/resume`, {}, techToken)).status).toBe(200);
    // invalid transitions rejected
    expect((await call('POST', `/api/sessions/${sid}/resume`, {}, techToken)).status).toBe(400);

    // Backdate the start event so the session has 8 working hours.
    env.DB._raw
      .prepare(`UPDATE session_events SET at = datetime(at, '-8 hours') WHERE session_id = ? AND event = 'start'`)
      .run(sid);
    env.DB._raw
      .prepare(`UPDATE session_events SET at = datetime(at, '-8 hours') WHERE session_id = ? AND event IN ('pause','resume')`)
      .run(sid);

    const stop = await call('POST', `/api/sessions/${sid}/stop`, { quantity: 47 }, techToken);
    expect(stop.status).toBe(200);
    expect(stop.data.metrics.totalHours).toBeCloseTo(8, 1);
    expect(stop.data.metrics.manHours).toBeCloseTo(16, 1);
    expect(stop.data.metrics.unitsPerManHour).toBeCloseTo(47 / 16, 1);

    // double stop rejected
    expect((await call('POST', `/api/sessions/${sid}/stop`, { quantity: 1 }, techToken)).status).toBe(400);
  });

  it('rejects stopping a device session without quantity', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const sys = catalog.data.systems[0];
    const start = await call(
      'POST',
      '/api/sessions',
      { mode: 'device', projectId, systemId: sys.id, deviceId: sys.devices[0].id, taskTypeId: catalog.data.taskTypes[0].id, crewSize: 1 },
      techToken,
    );
    const bad = await call('POST', `/api/sessions/${start.data.id}/stop`, {}, techToken);
    expect(bad.status).toBe(400);
    await call('POST', `/api/sessions/${start.data.id}/cancel`, {}, techToken);
  });

  it('runs a cable session with three auto-numbered reels', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const cat6a = catalog.data.cableTypes.find((ct: any) => ct.name === 'Cat6A');
    const pulling = catalog.data.taskTypes.find((t: any) => t.name === 'Cable Pulling');

    const start = await call(
      'POST',
      '/api/sessions',
      {
        mode: 'cable',
        projectId,
        cableTypeId: cat6a.id,
        taskTypeId: pulling.id,
        crewSize: 2,
        reels: [{ startingLength: 1000 }, { startingLength: 1000 }, { startingLength: 1000 }],
      },
      techToken,
    );
    expect(start.status).toBe(201);
    const sid = start.data.id;

    const detail = await call('GET', `/api/sessions/${sid}`, undefined, techToken);
    expect(detail.data.reels.map((r: any) => r.reel_number)).toEqual([1, 2, 3]);

    // reject impossible remaining footage
    const bad = await call(
      'POST',
      `/api/sessions/${sid}/stop`,
      { reels: [{ reelNumber: 1, remainingLength: 2000 }, { reelNumber: 2, remainingLength: 0 }, { reelNumber: 3, remainingLength: 0 }] },
      techToken,
    );
    expect(bad.status).toBe(400);

    env.DB._raw
      .prepare(`UPDATE session_events SET at = datetime(at, '-4 hours') WHERE session_id = ? AND event = 'start'`)
      .run(sid);

    const stop = await call(
      'POST',
      `/api/sessions/${sid}/stop`,
      { reels: [{ reelNumber: 1, remainingLength: 420 }, { reelNumber: 2, remainingLength: 125 }, { reelNumber: 3, remainingLength: 500 }] },
      techToken,
    );
    expect(stop.status).toBe(200);
    expect(stop.data.quantity).toBe(1955); // 580 + 875 + 500
    expect(stop.data.metrics.unitsPerHour).toBeCloseTo(1955 / 4, 0);
  });

  it('feeds the labor intelligence engine', async () => {
    const rates = await call('GET', '/api/intelligence/rates/devices', undefined, adminToken);
    const horn = rates.data.find((r: any) => r.device === 'Horn/Strobes');
    expect(horn).toBeTruthy();
    expect(horn.samples).toBe(1);
    expect(horn.actual_hours_per_unit).toBeCloseTo(16 / 47, 2);

    const cable = await call('GET', '/api/intelligence/rates/cable', undefined, adminToken);
    const cat6a = cable.data.find((r: any) => r.cable_type === 'Cat6A');
    expect(cat6a.total_feet).toBe(1955);

    const rec = await call('GET', `/api/intelligence/recommendations/estimate?deviceId=${horn.device_id}&quantity=100`, undefined, adminToken);
    expect(rec.status).toBe(200);
    expect(rec.data.learnedRate).toBeCloseTo(16 / 47, 2);
    expect(rec.data.recommendation.laborHours).toBeGreaterThan(0);
  });

  it('updates project labor status from recorded work', async () => {
    const labor = await call('GET', `/api/projects/${projectId}/labor`, undefined, adminToken);
    expect(labor.status).toBe(200);
    expect(labor.data.laborBudgetHours).toBe(500);
    expect(labor.data.spentLaborHours).toBeGreaterThan(20); // 16 + 8 man-hours
    expect(labor.data.earnedHours).toBeGreaterThan(0);
    expect(labor.data.completedSessions).toBe(2);
  });

  it('produces reports as JSON and CSV', async () => {
    const json = await call('GET', '/api/reports?period=weekly&groupBy=project', undefined, adminToken);
    expect(json.status).toBe(200);
    expect(json.data.rows.length).toBeGreaterThan(0);

    const res = await app.request(
      '/api/reports?period=weekly&groupBy=technician&format=csv',
      { headers: { Authorization: `Bearer ${adminToken}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    const csv = await res.text();
    expect(csv).toContain('Field Tech');
  });

  it('writes an audit trail', async () => {
    const audit = await call('GET', '/api/admin/audit', undefined, adminToken);
    expect(audit.status).toBe(200);
    const actions = audit.data.map((a: any) => a.action);
    expect(actions).toContain('session.complete');
    expect(actions).toContain('project.create');
  });

  it('revokes the session on logout', async () => {
    const login = await call('POST', '/api/auth/login', { email: 'tech@3dtsi.com', password: 'TechPassword#1' });
    const t = login.data.token;
    expect((await call('GET', '/api/auth/me', undefined, t)).status).toBe(200);
    await call('POST', '/api/auth/logout', {}, t);
    expect((await call('GET', '/api/auth/me', undefined, t)).status).toBe(401);
  });

  it('rejects requests without a token', async () => {
    expect((await call('GET', '/api/projects')).status).toBe(401);
    expect((await call('GET', '/api/sessions')).status).toBe(401);
  });
});
