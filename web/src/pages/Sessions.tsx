import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../lib/api';
import { formatNumber, parseDbDate } from '../lib/format';

export default function Sessions() {
  const navigate = useNavigate();
  const [active, setActive] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([get('/api/sessions/active'), get('/api/sessions')])
      .then(([a, h]) => {
        setActive(a);
        setHistory(h.filter((s: any) => s.status === 'completed'));
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Work</h1>
      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-500">In progress</h2>
          {active.map((s) => (
            <button key={s.id} onClick={() => navigate(`/session/${s.id}`)} className="card w-full text-left p-4 border-brand-500 hover:bg-ink-700 transition">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold">{s.device_name ?? `${s.cable_type_name} cable`}</div>
                  <div className="text-sm text-slate-400">{s.project_number} · {s.task_type_name}</div>
                </div>
                <span className={`text-xs font-bold ${s.status === 'running' ? 'text-brand-400' : 'text-gold-500'}`}>
                  {s.status === 'running' ? '● RUNNING' : '❚❚ PAUSED'}
                </span>
              </div>
            </button>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Completed</h2>
        {history.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <div className="font-bold">{s.device_name ?? `${s.cable_type_name} cable`}</div>
                <div className="text-sm text-slate-400">{s.project_number} · {s.task_type_name} · {s.created_by_name}</div>
                <div className="text-xs text-slate-500 mt-1">{parseDbDate(s.started_at).toLocaleString()}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-brand-400">{formatNumber(s.quantity, 1)} <span className="text-xs font-medium text-slate-400">{s.cable_type_name ? 'ft' : 'units'}</span></div>
                <div className="text-xs text-slate-400">{formatNumber(s.man_hours)} man-hrs · {formatNumber(s.units_per_man_hour)}/MH</div>
              </div>
            </div>
          </div>
        ))}
        {history.length === 0 && <div className="card p-8 text-center text-slate-400">No completed sessions yet. Select a project and press START.</div>}
      </section>
    </div>
  );
}
