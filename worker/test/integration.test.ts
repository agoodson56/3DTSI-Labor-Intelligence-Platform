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
  RESEND_API_KEY: 'test-key',
  EMAIL_FROM: 'Test <test@example.com>',
};

// Outbound email is stubbed - codes are read from the test database.
const sentEmails: Array<{ to: string; subject: string }> = [];
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes('api.resend.com')) {
    sentEmails.push(JSON.parse(init.body));
    return new Response('{"id":"stub"}', { status: 200 });
  }
  throw new Error(`Unexpected outbound fetch in tests: ${url}`);
}) as any;

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

  it('seeds all ten roles including Salesperson', async () => {
    const roles = await call('GET', '/api/admin/roles', undefined, adminToken);
    const names = roles.data.roles.map((r: any) => r.name);
    for (const expected of ['Administrator', 'Executive', 'Operations Manager', 'Estimator', 'Project Manager', 'Superintendent', 'Foreman', 'Lead Technician', 'Technician', 'Salesperson']) {
      expect(names).toContain(expected);
    }
    const sales = roles.data.roles.find((r: any) => r.name === 'Salesperson');
    expect(sales.permissions).toContain('intelligence.view');
    expect(sales.permissions).not.toContain('projects.manage');
    expect(sales.permissions).not.toContain('sessions.create');
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

  it('serves the expanded 3DTSI catalog (migration 0003)', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const names = catalog.data.systems.map((s: any) => s.name);
    for (const expected of [
      'Structured Cabling',
      'Fiber Optic Systems',
      'Access Control',
      'CCTV / Video Surveillance',
      'Intrusion Detection',
      'Networking',
      'Audio Visual',
      'Fire Alarm',
      'Data Center',
      'Specialty Electrical / Low Voltage',
      'Service',
    ]) {
      expect(names).toContain(expected);
    }
    const sc = catalog.data.systems.find((s: any) => s.name === 'Structured Cabling');
    const scNames = sc.devices.map((d: any) => d.name);
    expect(scNames).toContain('Cat6A Cable');
    expect(scNames).toContain('J-Hook');
    expect(scNames).not.toContain('Fiber'); // deactivated generic

    const networking = catalog.data.systems.find((s: any) => s.name === 'Networking');
    expect(networking.devices.map((d: any) => d.name)).toContain('PoE Switch');
    expect(networking.devices.map((d: any) => d.name)).not.toContain('Switches');

    const cableTypes = catalog.data.cableTypes.map((ct: any) => ct.name);
    expect(cableTypes).toContain('144 Strand Fiber');
    expect(cableTypes).toContain('Shielded Cat6A');
  });

  it('runs a device-installation session: start -> pause -> resume -> stop(47 horn strobes)', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const fireAlarm = catalog.data.systems.find((s: any) => s.name === 'Fire Alarm');
    const hornStrobe = fireAlarm.devices.find((d: any) => d.name === 'Horn Strobe');
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

  it('lets technicians optionally name their crew members', async () => {
    // any signed-in user can list technicians (names only)
    const techs = await call('GET', '/api/catalog/technicians', undefined, techToken);
    expect(techs.status).toBe(200);
    expect(techs.data.length).toBeGreaterThanOrEqual(2);
    expect(techs.data[0].email).toBeUndefined(); // no emails exposed
    const admin = techs.data.find((t: any) => t.full_name === 'System Admin');

    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const cat6 = catalog.data.cableTypes.find((ct: any) => ct.name === 'Cat6');
    const pulling = catalog.data.taskTypes.find((t: any) => t.name === 'Cable Pulling');

    const start = await call(
      'POST',
      '/api/sessions',
      {
        mode: 'cable',
        projectId,
        cableTypeId: cat6.id,
        taskTypeId: pulling.id,
        crewSize: 2,
        reels: [{ startingLength: 500 }],
        technicianIds: [admin.id],
      },
      techToken,
    );
    expect(start.status).toBe(201);
    const detail = await call('GET', `/api/sessions/${start.data.id}`, undefined, techToken);
    const names = detail.data.technicians.map((t: any) => t.full_name).sort();
    expect(names).toContain('System Admin'); // selected crew member
    expect(names).toContain('Field Tech'); // creator auto-included
    await call('POST', `/api/sessions/${start.data.id}/cancel`, {}, techToken);
  });

  it('limits cable sessions to 30 reels', async () => {
    const catalog = await call('GET', '/api/catalog', undefined, techToken);
    const cat6 = catalog.data.cableTypes.find((ct: any) => ct.name === 'Cat6');
    const pulling = catalog.data.taskTypes.find((t: any) => t.name === 'Cable Pulling');

    // 31 reels at creation -> rejected
    const tooMany = await call(
      'POST',
      '/api/sessions',
      { mode: 'cable', projectId, cableTypeId: cat6.id, taskTypeId: pulling.id, crewSize: 2, reels: Array.from({ length: 31 }, () => ({ startingLength: 1000 })) },
      techToken,
    );
    expect(tooMany.status).toBe(400);
    expect(tooMany.data.error).toContain('30');

    // exactly 30 allowed; adding a 31st mid-session -> rejected
    const ok = await call(
      'POST',
      '/api/sessions',
      { mode: 'cable', projectId, cableTypeId: cat6.id, taskTypeId: pulling.id, crewSize: 2, reels: Array.from({ length: 30 }, () => ({ startingLength: 1000 })) },
      techToken,
    );
    expect(ok.status).toBe(201);
    const extra = await call('POST', `/api/sessions/${ok.data.id}/reels`, { startingLength: 500 }, techToken);
    expect(extra.status).toBe(400);
    await call('POST', `/api/sessions/${ok.data.id}/cancel`, {}, techToken);
  });

  it('feeds the labor intelligence engine', async () => {
    const rates = await call('GET', '/api/intelligence/rates/devices', undefined, adminToken);
    const horn = rates.data.find((r: any) => r.device === 'Horn Strobe');
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

  it('bulk imports projects from spreadsheet rows', async () => {
    const res = await call(
      'POST',
      '/api/projects/import',
      {
        rows: [
          {
            projectNumber: 'P-2026-201',
            name: 'Imported Fire Alarm Job',
            customer: 'New Import Customer',
            marketSegment: 'Education',
            projectType: 'Installation',
            officeLocation: 'Dallas',
            laborBudgetHours: 100,
            systems: 'Fire Alarm, Access Control',
          },
          { projectNumber: 'P-2026-001', name: 'Duplicate', customer: 'Metro General Hospital' },
          { projectNumber: '', name: 'Missing fields', customer: '' },
          {
            projectNumber: 'P-2026-202',
            name: 'Imported Camera Job',
            customer: 'Metro General Hospital',
            systems: 'Bogus System, CCTV / Video Surveillance',
            pmEmail: 'admin@3dtsi.com',
          },
        ],
      },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.created).toBe(2);
    expect(res.data.skipped).toBe(1);
    expect(res.data.errors).toBe(1);

    const first = res.data.results.find((r: any) => r.projectNumber === 'P-2026-201');
    expect(first.status).toBe('created');
    expect(first.systems).toBe(2);
    expect(first.qrToken).toBeTruthy();

    const second = res.data.results.find((r: any) => r.projectNumber === 'P-2026-202');
    expect(second.message).toContain('unknown systems ignored: Bogus System');

    // imported customer was auto-created
    const customers = await call('GET', '/api/projects/customers/list', undefined, adminToken);
    expect(customers.data.some((c: any) => c.name === 'New Import Customer')).toBe(true);

    // project list and detail expose the systems scope
    const list = await call('GET', '/api/projects?q=P-2026-201', undefined, adminToken);
    expect(list.data[0].systems_list.split(', ').sort()).toEqual(['Access Control', 'Fire Alarm']);
    const detail = await call('GET', `/api/projects/${list.data[0].id}`, undefined, adminToken);
    expect(detail.data.systems.map((s: any) => s.name).sort()).toEqual(['Access Control', 'Fire Alarm']);

    // technicians cannot import
    expect((await call('POST', '/api/projects/import', { rows: [{}] }, techToken)).status).toBe(403);

    // re-import of the same file is fully idempotent
    const again = await call('POST', '/api/projects/import', { rows: [{ projectNumber: 'P-2026-201', name: 'X', customer: 'Y' }] }, adminToken);
    expect(again.data.skipped).toBe(1);
  });

  it('imports a single PM project form with foreman/lead and PM matched by name', async () => {
    const res = await call(
      'POST',
      '/api/projects/import',
      {
        rows: [
          {
            projectNumber: 'P-2026-301',
            name: 'Form Import Job',
            customer: 'Metro General Hospital',
            siteAddress: '1 Form Way',
            pmEmail: 'System Admin', // name, not email - matched against users.full_name
            superintendent: 'Sam Super',
            foreman: 'Mike Foreman',
            lead: 'Larry Lead',
            systems: 'Fire Alarm',
          },
        ],
      },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect(res.data.created).toBe(1);
    expect(res.data.results[0].message).not.toContain('not found'); // PM matched by name

    const list = await call('GET', '/api/projects?q=P-2026-301', undefined, adminToken);
    expect(list.data[0].superintendent_name).toBe('Sam Super');
    expect(list.data[0].foreman_name).toBe('Mike Foreman');
    expect(list.data[0].lead_name).toBe('Larry Lead');
    expect(list.data[0].pm_name).toBe('System Admin');
    expect(list.data[0].systems_list).toBe('Fire Alarm');
  });

  it('deletes projects without history and archives projects with recorded labor', async () => {
    // technician cannot delete
    expect((await call('DELETE', `/api/projects/${projectId}`, undefined, techToken)).status).toBe(403);

    // clean project (imported earlier, no sessions) -> hard delete
    const clean = (await call('GET', '/api/projects?q=P-2026-202', undefined, adminToken)).data[0];
    const delClean = await call('DELETE', `/api/projects/${clean.id}`, undefined, adminToken);
    expect(delClean.status).toBe(200);
    expect(delClean.data.action).toBe('deleted');
    expect((await call('GET', `/api/projects/${clean.id}`, undefined, adminToken)).status).toBe(404);

    // project with completed sessions -> archived, history preserved
    const delUsed = await call('DELETE', `/api/projects/${projectId}`, undefined, adminToken);
    expect(delUsed.status).toBe(200);
    expect(delUsed.data.action).toBe('archived');
    const active = await call('GET', '/api/projects?status=active', undefined, adminToken);
    expect(active.data.some((p: any) => p.id === projectId)).toBe(false); // hidden from field
    const detail = await call('GET', `/api/projects/${projectId}`, undefined, adminToken);
    expect(detail.data.status).toBe('archived'); // still exists for reporting
    const labor = await call('GET', `/api/projects/${projectId}/labor`, undefined, adminToken);
    expect(labor.data.completedSessions).toBe(2); // intelligence history intact
  });

  it('self-registration: requires @3dtsi.com, blocks login until the emailed code verifies', async () => {
    // wrong domain rejected
    const bad = await call('POST', '/api/auth/register', { email: 'tech@gmail.com', password: 'GoodPassword#1', fullName: 'Outsider' });
    expect(bad.status).toBe(400);
    expect(bad.data.error).toContain('@3dtsi.com');

    // valid registration sends a code
    const reg = await call('POST', '/api/auth/register', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1', fullName: 'New Tech' });
    expect(reg.status).toBe(200);
    expect(sentEmails.some((e: any) => e.to?.[0] === 'newtech@3dtsi.com')).toBe(true);

    // duplicate registration rejected
    expect((await call('POST', '/api/auth/register', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1', fullName: 'Dup' })).status).toBe(409);

    // login blocked before verification
    const blocked = await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1' });
    expect(blocked.status).toBe(403);
    expect(blocked.data.needsVerification).toBe(true);

    // wrong code rejected, real code (from DB) accepted
    expect((await call('POST', '/api/auth/verify-email', { email: 'newtech@3dtsi.com', code: '000000' })).status).toBe(400);
    const row = env.DB._raw.prepare(`SELECT verify_code FROM users WHERE email = 'newtech@3dtsi.com'`).get();
    const verified = await call('POST', '/api/auth/verify-email', { email: 'newtech@3dtsi.com', code: row.verify_code });
    expect(verified.status).toBe(200);

    // login now works, with the default Technician role
    const login = await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1' });
    expect(login.status).toBe(200);
    expect(login.data.user.role).toBe('Technician');
  });

  it('activates accounts immediately when no email service is configured', async () => {
    const savedKey = env.RESEND_API_KEY;
    delete env.RESEND_API_KEY;
    try {
      // wrong domain still rejected
      expect((await call('POST', '/api/auth/register', { email: 'x@gmail.com', password: 'GoodPassword#1', fullName: 'X' })).status).toBe(400);

      const reg = await call('POST', '/api/auth/register', { email: 'instant@3dtsi.com', password: 'GoodPassword#1', fullName: 'Instant Tech' });
      expect(reg.status).toBe(200);
      expect(reg.data.verificationRequired).toBe(false);

      // can sign in right away - no code needed
      const login = await call('POST', '/api/auth/login', { email: 'instant@3dtsi.com', password: 'GoodPassword#1' });
      expect(login.status).toBe(200);
      expect(login.data.user.role).toBe('Technician');
    } finally {
      env.RESEND_API_KEY = savedKey;
    }
  });

  it('forgot-password resets via emailed code and revokes old sessions', async () => {
    const oldLogin = await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1' });
    const oldToken = oldLogin.data.token;

    expect((await call('POST', '/api/auth/forgot-password', { email: 'newtech@3dtsi.com' })).status).toBe(200);
    const row = env.DB._raw.prepare(`SELECT reset_code FROM users WHERE email = 'newtech@3dtsi.com'`).get();
    expect(row.reset_code).toBeTruthy();

    // short password rejected, then real reset
    expect((await call('POST', '/api/auth/reset-password', { email: 'newtech@3dtsi.com', code: row.reset_code, newPassword: 'short' })).status).toBe(400);
    const reset = await call('POST', '/api/auth/reset-password', { email: 'newtech@3dtsi.com', code: row.reset_code, newPassword: 'BrandNewPass#42' });
    expect(reset.status).toBe(200);

    // old password dead, old session revoked, new password works
    expect((await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'GoodPassword#1' })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', undefined, oldToken)).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'BrandNewPass#42' })).status).toBe(200);
  });

  it('authenticated users can change their own password', async () => {
    const login = await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'BrandNewPass#42' });
    const t = login.data.token;
    expect((await call('POST', '/api/auth/me/password', { currentPassword: 'wrong', newPassword: 'AnotherPass#99x' }, t)).status).toBe(401);
    expect((await call('POST', '/api/auth/me/password', { currentPassword: 'BrandNewPass#42', newPassword: 'AnotherPass#99x' }, t)).status).toBe(200);
    expect((await call('POST', '/api/auth/login', { email: 'newtech@3dtsi.com', password: 'AnotherPass#99x' })).status).toBe(200);
  });

  it('rejects requests without a token', async () => {
    expect((await call('GET', '/api/projects')).status).toBe(401);
    expect((await call('GET', '/api/sessions')).status).toBe(401);
  });
});
