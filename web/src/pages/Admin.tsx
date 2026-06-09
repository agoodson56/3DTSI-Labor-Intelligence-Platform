import { useEffect, useState, type FormEvent } from 'react';
import { get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Admin() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles' | 'projects' | 'catalog'>('users');
  const tabs = [
    can('users.view') && { key: 'users', label: 'Users' },
    can('users.view') && { key: 'roles', label: 'Roles' },
    can('projects.manage') && { key: 'projects', label: 'Projects' },
    can('catalog.manage') && { key: 'catalog', label: 'Catalog' },
  ].filter(Boolean) as Array<{ key: any; label: string }>;

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
                <div className="text-xs text-slate-400">{u.email} · <span className="text-gold-500">{u.role}</span>{u.mfa_enabled ? ' · 🔒 MFA' : ''}</div>
              </div>
              {can('users.manage') && (
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => toggleActive(u)}>{u.active ? 'Disable' : 'Enable'}</button>
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

  return (
    <div className="grid lg:grid-cols-2 gap-5">
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
                </div>
                <button className="btn-outline px-3 py-1.5 text-xs shrink-0" onClick={() => setQr({ project: p.project_number, token: p.qr_token })}>QR</button>
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
