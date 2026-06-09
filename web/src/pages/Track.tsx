import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';

interface Catalog {
  systems: Array<{ id: number; name: string; devices: Array<{ id: number; name: string; unit: string }> }>;
  taskTypes: Array<{ id: number; name: string }>;
  cableTypes: Array<{ id: number; name: string }>;
}

export default function Track() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mode, setMode] = useState<'device' | 'cable'>('device');
  const [systemId, setSystemId] = useState<number | ''>('');
  const [deviceId, setDeviceId] = useState<number | ''>('');
  const [cableTypeId, setCableTypeId] = useState<number | ''>('');
  const [taskTypeId, setTaskTypeId] = useState<number | ''>('');
  const [crewSize, setCrewSize] = useState(2);
  const [reels, setReels] = useState<number[]>([1000]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([get(`/api/projects/${projectId}`), get<Catalog>('/api/catalog')])
      .then(([p, cat]) => {
        setProject(p);
        setCatalog(cat);
        const install = cat.taskTypes.find((t) => t.name === 'Device Installation');
        if (install) setTaskTypeId(install.id);
      })
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!catalog) return;
    const wanted = mode === 'cable' ? 'Cable Pulling' : 'Device Installation';
    const t = catalog.taskTypes.find((x) => x.name === wanted);
    if (t) setTaskTypeId(t.id);
  }, [mode, catalog]);

  const devices = useMemo(
    () => catalog?.systems.find((s) => s.id === systemId)?.devices ?? [],
    [catalog, systemId],
  );

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      const payload: any = { mode, projectId: Number(projectId), taskTypeId, crewSize };
      if (mode === 'device') {
        payload.systemId = systemId;
        payload.deviceId = deviceId;
      } else {
        payload.cableTypeId = cableTypeId;
        payload.reels = reels.map((len) => ({ startingLength: len }));
      }
      const res = await post('/api/sessions', payload);
      navigate(`/session/${res.id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const ready =
    taskTypeId && crewSize >= 1 && (mode === 'device' ? systemId && deviceId : cableTypeId && reels.every((r) => r > 0));

  if (!project || !catalog) return <div className="text-slate-400 animate-pulse">Loading…</div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <button onClick={() => navigate('/projects')} className="text-sm text-brand-400 mb-2">← Projects</button>
        <h1 className="text-2xl font-bold">
          <span className="text-brand-400">{project.project_number}</span> · {project.name}
        </h1>
        <div className="text-sm text-slate-400">{project.customer_name} {project.site_address ? `· ${project.site_address}` : ''}</div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setMode('device')} className={`card p-4 text-left transition ${mode === 'device' ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}>
          <div className="text-2xl mb-1">🔧</div>
          <div className="font-bold">Device Installation</div>
          <div className="text-xs text-slate-400 mt-1">Track devices installed per hour</div>
        </button>
        <button onClick={() => setMode('cable')} className={`card p-4 text-left transition ${mode === 'cable' ? 'border-gold-500 ring-1 ring-gold-500' : ''}`}>
          <div className="text-2xl mb-1">🧵</div>
          <div className="font-bold">Cable Installation</div>
          <div className="text-xs text-slate-400 mt-1">Track footage pulled by reel</div>
        </button>
      </div>

      <div className="card p-5 space-y-4">
        {mode === 'device' ? (
          <>
            <div>
              <label className="label">System</label>
              <select className="input" value={systemId} onChange={(e) => { setSystemId(Number(e.target.value) || ''); setDeviceId(''); }}>
                <option value="">Select system…</option>
                {catalog.systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Device</label>
              <select className="input" value={deviceId} onChange={(e) => setDeviceId(Number(e.target.value) || '')} disabled={!systemId}>
                <option value="">Select device…</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.unit})</option>)}
              </select>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label">Cable type</label>
              <select className="input" value={cableTypeId} onChange={(e) => setCableTypeId(Number(e.target.value) || '')}>
                <option value="">Select cable type…</option>
                {catalog.cableTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cable reels (starting footage)</label>
              <div className="space-y-2">
                {reels.map((len, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 w-16 shrink-0">Reel #{i + 1}</span>
                    <input className="input" type="number" min={1} value={len || ''} onChange={(e) => setReels(reels.map((r, j) => (j === i ? Number(e.target.value) : r)))} />
                    {reels.length > 1 && (
                      <button className="btn-outline px-3 py-2 text-sm" onClick={() => setReels(reels.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn-outline px-3 py-2 text-sm mt-2" onClick={() => setReels([...reels, 1000])}>+ Add reel</button>
            </div>
          </>
        )}

        <div>
          <label className="label">Task type</label>
          <select className="input" value={taskTypeId} onChange={(e) => setTaskTypeId(Number(e.target.value) || '')}>
            {catalog.taskTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Number of technicians (crew size)</label>
          <div className="flex items-center gap-3">
            <button className="btn-outline w-12 h-12 text-xl" onClick={() => setCrewSize(Math.max(1, crewSize - 1))}>−</button>
            <div className="text-3xl font-black text-brand-400 w-12 text-center">{crewSize}</div>
            <button className="btn-outline w-12 h-12 text-xl" onClick={() => setCrewSize(crewSize + 1)}>+</button>
          </div>
        </div>
      </div>

      <button className="btn-primary w-full py-4 text-lg" disabled={!ready || busy} onClick={start}>
        {busy ? 'Starting…' : '▶ START'}
      </button>
    </div>
  );
}
