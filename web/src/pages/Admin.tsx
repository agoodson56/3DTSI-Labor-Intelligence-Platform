import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { del, get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Admin() {
  const { can } = useAuth();
  const tabs = [
    can('users.view') && { key: 'users', label: 'Users' },
    can('users.view') && { key: 'roles', label: 'Roles' },
    can('projects.manage') && { key: 'projects', label: 'Projects' },
    can('catalog.manage') && { key: 'catalog', label: 'Catalog' },
  ].filter(Boolean) as Array<{ key: any; label: string }>;
  const [tab, setTab] = useState<'users' | 'roles' | 'projects' | 'catalog'>(tabs[0]?.key ?? 'users');

  if (tabs.length === 0) {
    return (
      <div className="card p-10 text-center text-slate-400 max-w-xl">
        🔒 Your role doesn't have access to the administration area.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Administration</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-ink-700 text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <Users />}
      {tab === 'roles' && <Roles />}
      {tab === 'projects' && <Projects />}
      {tab === 'catalog' && <Catalog />}
    </div>
  );
}

function Users() {
  const { can } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', roleId: '', officeLocation: '' });
  const [msg, setMsg] = useState('');

  const load = () =>
    Promise.all([get('/api/admin/users'), get('/api/admin/roles')]).then(([u, r]) => {
      setUsers(u);
      setRoles(r.roles);
    });
  useEffect(() => { load(); }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      await post('/api/admin/users', { ...form, roleId: Number(form.roleId) });
      setForm({ email: '', fullName: '', password: '', roleId: '', officeLocation: '' });
      setMsg('User created.');
      load();
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  const toggleActive = async (u: any) => {
    await put(`/api/admin/users/${u.id}`, { fullName: u.full_name, roleId: u.role_id, officeLocation: u.office_location, phone: u.phone, active: !u.active });
    load();
  };

  const changeRole = async (u: any, roleId: number) => {
    await put(`/api/admin/users/${u.id}`, { fullName: u.full_name, roleId, officeLocation: u.office_location, phone: u.phone, active: !!u.active });
    load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {can('users.manage') && (
        <form onSubmit={create} className="card p-5 space-y-3">
          <h2 className="font-bold">Add user</h2>
          {msg && <div className="text-sm text-gold-400">{msg}</div>}
          <input className="input" placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Full name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="input" placeholder="Temporary password (10+ chars)" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">Role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input className="input" placeholder="Office location" value={form.officeLocation} onChange={(e) => setForm({ ...form, officeLocation: e.target.value })} />
          <button className="btn-primary w-full py-2.5">Create user</button>
        </form>
      )}
      <div className="card p-5">
        <h2 className="font-bold mb-3">Users ({users.length})</h2>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-ink-700">
              <div>
                <div className="text-sm font-semibold">{u.full_name} {!u.active && <span className="text-red-400 text-xs">(disabled)</span>}</div>
                <div className="text-xs text-slate-400">{u.email}{u.mfa_enabled ? ' · 🔒 MFA' : ''}</div>
              </div>
              {can('users.manage') ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <select className="input !w-auto !py-1.5 !px-2 text-xs" value={u.role_id} onChange={(e) => changeRole(u, Number(e.target.value))}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
                </div>
              ) : (
                <span className="text-gold-500 text-xs">{u.role}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Roles() {
  const { can } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const load = () =>
    get('/api/admin/roles').then((r) => {
      setRoles(r.roles);
      setAvailable(r.availablePermissions.filter((p: string) => p !== '*'));
    });
  useEffect(() => { load(); }, []);

  const save = async () => {
    await put(`/api/admin/roles/${editing.id}`, { description: editing.description, permissions: editing.permissions });
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-3">
      {roles.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-slate-400">{r.description}</div>
            </div>
            {can('roles.manage') && r.permissions[0] !== '*' && (
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditing({ ...r })}>Edit permissions</button>
            )}
          </div>
          {editing?.id === r.id ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {available.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editing.permissions.includes(p)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          permissions: e.target.checked ? [...editing.permissions, p] : editing.permissions.filter((x: string) => x !== p),
                        })
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary px-4 py-2 text-sm" onClick={save}>Save</button>
                <button className="btn-outline px-4 py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {r.permissions.map((p: string) => (
                <span key={p} className="text-[10px] bg-ink-700 border border-ink-500 rounded-full px-2 py-0.5 text-slate-300">{p}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Parses a form-style workbook (the PM project form: "Description / Answer"
 * rows like "Project Name", "Project Foreman", "Project System #1"...).
 * Returns one import row, or null if the sheet isn't form-shaped.
 */
function parseProjectForm(rows: unknown[][]): Record<string, unknown> | null {
  const kv = new Map<string, string>();
  const systems: string[] = [];
  for (const row of rows) {
    const key = String(row?.[0] ?? '').trim();
    const value = String(row?.[1] ?? '').trim();
    if (!key) continue;
    const norm = key.toLowerCase().replace(/[^a-z0-9#]/g, '');
    if (norm.startsWith('projectsystem')) {
      if (value) systems.push(value);
    } else {
      kv.set(norm, value);
    }
  }
  if (!kv.has('projectname')) return null;
  const v = (k: string) => kv.get(k) ?? '';
  return {
    projectNumber: v('projectnumber'),
    name: v('projectname'),
    customer: v('customer') || v('customername'),
    siteAddress: v('projectaddress') || v('siteaddress'),
    marketSegment: v('marketsegment'),
    projectType: v('projecttype'),
    officeLocation: v('officelocation') || v('office'),
    laborBudgetHours: v('laborbudgethours'),
    pmEmail: v('projectmanager') || v('pmemail'),
    superintendent: v('projectsuperintendent') || v('superintendent'),
    foreman: v('projectforemanlead') || v('projectforeman') || v('foreman'),
    lead: v('projectlead') || v('lead'),
    systems: systems.join(', '),
  };
}

/** Maps spreadsheet headers ("Project Number*", "Systems (comma-separated)") to API fields. */
function normalizeImportRow(raw: Record<string, unknown>): Record<string, unknown> {
  const FIELDS: Record<string, string> = {
    projectnumber: 'projectNumber',
    projectname: 'name',
    customer: 'customer',
    siteaddress: 'siteAddress',
    marketsegment: 'marketSegment',
    projecttype: 'projectType',
    officelocation: 'officeLocation',
    laborbudgethours: 'laborBudgetHours',
    pmemail: 'pmEmail',
    systems: 'systems',
  };
  const out: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = header.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
    const field = FIELDS[key];
    if (field) out[field] = value;
  }
  return out;
}

function ImportProjects({ onImported }: { onImported: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    setResults(null);
    setRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx'); // loaded on demand - keeps the field app bundle small
      const wb = XLSX.read(await file.arrayBuffer());
      const sheetName = wb.SheetNames.includes('Projects')
        ? 'Projects'
        : wb.SheetNames.includes('Project Form')
          ? 'Project Form'
          : wb.SheetNames[0];

      // Try the single-project PM form layout first, then the bulk table layout.
      const asGrid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' });
      const formRow = parseProjectForm(asGrid);
      if (formRow) {
        setRows([formRow]);
        return;
      }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' });
      const mapped = raw.map(normalizeImportRow).filter((r) => r.projectNumber || r.name || r.customer);
      if (mapped.length === 0) {
        setError('No project rows found. Use the project form or the bulk template.');
        return;
      }
      setRows(mapped);
    } catch {
      setError('Could not read that file. Upload the .xlsx template or a CSV with the same columns.');
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await post('/api/projects/import', { rows });
      setResults(res);
      setRows([]);
      onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-3 lg:col-span-2">
      <h2 className="font-bold">Create projects from Excel</h2>
      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-ink-700 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Step 1 · Download &amp; fill out</div>
          <div className="flex flex-col gap-2">
            <a className="btn-gold px-4 py-2.5 text-sm" href="/templates/3DTSI-Project-Form.xlsx" download>
              ⬇ Download Project Form
            </a>
            <a className="btn-outline px-4 py-2 text-xs" href="/templates/3DTSI-Project-Import-Template.xlsx" download>
              ⬇ Download Bulk Template (many projects)
            </a>
          </div>
          <p className="text-xs text-slate-400 mt-2">The Project Form is what a PM fills out for one project. Fill the Answer column in Excel and save.</p>
        </div>
        <div className="rounded-xl bg-ink-700 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Step 2 · Upload the filled file</div>
          <label className="btn-primary px-4 py-2.5 text-sm w-full cursor-pointer">
            ⬆ Upload Project
            <input type="file" accept=".xlsx,.xls,.csv" onChange={pickFile} className="hidden" />
          </label>
          <p className="text-xs text-slate-400 mt-2">Pick your saved form (or bulk file) - the format is detected automatically, then confirm the import.</p>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-ink-700">
          <div className="text-sm">
            <span className="font-bold text-brand-400">{rows.length}</span> project{rows.length > 1 ? 's' : ''} ready from <span className="text-slate-300">{fileName}</span>
          </div>
          <button className="btn-gold px-4 py-2 text-sm" disabled={busy} onClick={runImport}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}
      {results && (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-brand-400 font-bold">{results.created} created</span>
            {results.skipped > 0 && <span className="text-gold-400"> · {results.skipped} skipped</span>}
            {results.errors > 0 && <span className="text-red-400"> · {results.errors} errors</span>}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {results.results.map((r: any, i: number) => (
              <div key={i} className="text-xs flex gap-2">
                <span className="text-slate-500 w-12 shrink-0">Row {r.row}</span>
                <span className={r.status === 'created' ? 'text-brand-400' : r.status === 'skipped' ? 'text-gold-400' : 'text-red-400'}>
                  {r.status}
                </span>
                <span className="text-slate-300">{r.projectNumber}</span>
                <span className="text-slate-500 truncate">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({ projectNumber: '', name: '', customerId: '', siteAddress: '', marketSegment: 'Commercial', projectType: 'Installation', officeLocation: '', laborBudgetHours: '' });
  const [newCustomer, setNewCustomer] = useState('');
  const [msg, setMsg] = useState('');
  const [qr, setQr] = useState<{ project: string; token: string } | null>(null);

  const load = () =>
    Promise.all([get('/api/projects'), get('/api/projects/customers/list')]).then(([p, c]) => {
      setProjects(p);
      setCustomers(c);
    });
  useEffect(() => { load(); }, []);

  const addCustomer = async () => {
    if (!newCustomer) return;
    await post('/api/projects/customers', { name: newCustomer, marketSegment: form.marketSegment });
    setNewCustomer('');
    load();
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await post('/api/projects', { ...form, customerId: Number(form.customerId), laborBudgetHours: Number(form.laborBudgetHours) || 0 });
      setMsg(`Project created. QR token: ${res.qrToken}`);
      setForm({ ...form, projectNumber: '', name: '', siteAddress: '', laborBudgetHours: '' });
      load();
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  const remove = async (p: any) => {
    if (!confirm(`Delete project ${p.project_number} · ${p.name}?\n\nIf it has recorded work it will be archived (history kept); otherwise it is permanently deleted.`)) return;
    try {
      const res = await del(`/api/projects/${p.id}`);
      setMsg(res.message);
      load();
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <ImportProjects onImported={load} />
      <form onSubmit={create} className="card p-5 space-y-3">
        <h2 className="font-bold">New project</h2>
        {msg && <div className="text-sm text-gold-400 break-all">{msg}</div>}
        <input className="input" placeholder="Project number" required value={form.projectNumber} onChange={(e) => setForm({ ...form, projectNumber: e.target.value })} />
        <input className="input" placeholder="Project name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="flex gap-2">
          <select className="input" required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input className="input" placeholder="New customer name" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} />
          <button type="button" className="btn-outline px-4 shrink-0" onClick={addCustomer}>Add</button>
        </div>
        <input className="input" placeholder="Site address" value={form.siteAddress} onChange={(e) => setForm({ ...form, siteAddress: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.marketSegment} onChange={(e) => setForm({ ...form, marketSegment: e.target.value })}>
            {['Healthcare', 'Education', 'Government', 'Military', 'Commercial', 'Industrial', 'Data Centers'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <select className="input" value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })}>
            {['Installation', 'Retrofit', 'Service', 'Design-Build', 'Tenant Improvement'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Office location" value={form.officeLocation} onChange={(e) => setForm({ ...form, officeLocation: e.target.value })} />
          <input className="input" placeholder="Labor budget (hrs)" type="number" value={form.laborBudgetHours} onChange={(e) => setForm({ ...form, laborBudgetHours: e.target.value })} />
        </div>
        <button className="btn-primary w-full py-2.5">Create project</button>
      </form>

      <div className="card p-5">
        <h2 className="font-bold mb-3">Projects ({projects.length})</h2>
        <div className="space-y-2 max-h-[32rem] overflow-y-auto">
          {projects.map((p) => (
            <div key={p.id} className="p-2 rounded-xl hover:bg-ink-700">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold"><span className="text-brand-400">{p.project_number}</span> {p.name}</div>
                  <div className="text-xs text-slate-400">{p.customer_name} · {p.market_segment} · {p.status}</div>
                  {p.systems_list && <div className="text-[11px] text-brand-300 mt-0.5">🔧 {p.systems_list}</div>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setQr({ project: p.project_number, token: p.qr_token })}>QR</button>
                  <button className="btn-outline px-2.5 py-1.5 text-xs !text-red-400 hover:!border-red-500" title="Delete project" onClick={() => remove(p)}>🗑</button>
                </div>
              </div>
              {qr !== null && qr.token === p.qr_token && (
                <div className="mt-2 p-3 bg-white rounded-xl text-center">
                  <img className="mx-auto" width={180} height={180} alt={`QR for ${qr.project}`}
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qr.token)}`} />
                  <div className="text-ink-900 text-xs font-bold mt-2">{qr.project}</div>
                  <div className="text-ink-900/60 text-[10px] break-all">{qr.token}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Catalog() {
  const [catalog, setCatalog] = useState<any>(null);
  const [system, setSystem] = useState('');
  const [device, setDevice] = useState({ systemId: '', name: '', unit: 'each', estimateHoursPerUnit: '' });
  const [msg, setMsg] = useState('');

  const load = () => get('/api/catalog').then(setCatalog);
  useEffect(() => { load(); }, []);

  const addSystem = async () => {
    if (!system) return;
    await post('/api/catalog/systems', { name: system });
    setSystem('');
    setMsg('System added.');
    load();
  };

  const addDevice = async (e: FormEvent) => {
    e.preventDefault();
    await post('/api/catalog/devices', { ...device, systemId: Number(device.systemId), estimateHoursPerUnit: Number(device.estimateHoursPerUnit) || 0 });
    setDevice({ ...device, name: '', estimateHoursPerUnit: '' });
    setMsg('Device added.');
    load();
  };

  if (!catalog) return <div className="text-slate-400 animate-pulse">Loading…</div>;

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="space-y-5">
        {msg && <div className="text-sm text-gold-400">{msg}</div>}
        <div className="card p-5 space-y-3">
          <h2 className="font-bold">Add system</h2>
          <div className="flex gap-2">
            <input className="input" placeholder="System name" value={system} onChange={(e) => setSystem(e.target.value)} />
            <button className="btn-primary px-4 shrink-0" onClick={addSystem}>Add</button>
          </div>
        </div>
        <form onSubmit={addDevice} className="card p-5 space-y-3">
          <h2 className="font-bold">Add device</h2>
          <select className="input" required value={device.systemId} onChange={(e) => setDevice({ ...device, systemId: e.target.value })}>
            <option value="">System…</option>
            {catalog.systems.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" placeholder="Device name" required value={device.name} onChange={(e) => setDevice({ ...device, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={device.unit} onChange={(e) => setDevice({ ...device, unit: e.target.value })}>
              <option value="each">each</option>
              <option value="feet">feet</option>
            </select>
            <input className="input" placeholder="Est. hrs/unit" type="number" step="0.0001" value={device.estimateHoursPerUnit} onChange={(e) => setDevice({ ...device, estimateHoursPerUnit: e.target.value })} />
          </div>
          <button className="btn-primary w-full py-2.5">Add device</button>
        </form>
      </div>
      <div className="card p-5">
        <h2 className="font-bold mb-3">Catalog</h2>
        <div className="space-y-4 max-h-[32rem] overflow-y-auto">
          {catalog.systems.map((s: any) => (
            <div key={s.id}>
              <div className="text-sm font-bold text-brand-400">{s.name}</div>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {s.devices.map((d: any) => (
                  <span key={d.id} className="text-[11px] bg-ink-700 border border-ink-500 rounded-full px-2 py-0.5 text-slate-300">
                    {d.name} <span className="text-slate-500">({d.estimate_hours_per_unit}h/{d.unit})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
