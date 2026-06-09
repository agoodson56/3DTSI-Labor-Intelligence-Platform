import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import { formatHMS, formatNumber } from '../lib/format';

export default function ActiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [remaining, setRemaining] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const baseRef = useRef({ seconds: 0, at: Date.now(), running: false });

  const load = async () => {
    try {
      const s = await get(`/api/sessions/${sessionId}`);
      setSession(s);
      baseRef.current = { seconds: s.liveActiveSeconds, at: Date.now(), running: s.status === 'running' };
      setSeconds(s.liveActiveSeconds);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  useEffect(() => {
    const id = setInterval(() => {
      const b = baseRef.current;
      setSeconds(b.running ? b.seconds + Math.floor((Date.now() - b.at) / 1000) : b.seconds);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const act = async (action: 'pause' | 'resume') => {
    setBusy(true);
    setError('');
    try {
      await post(`/api/sessions/${sessionId}/${action}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    try {
      const payload: any = {};
      if (session.mode === 'device') {
        payload.quantity = Number(quantity);
      } else {
        payload.reels = session.reels.map((r: any) => ({
          reelNumber: r.reel_number,
          remainingLength: Number(remaining[r.reel_number] ?? ''),
        }));
      }
      const res = await post(`/api/sessions/${sessionId}/stop`, payload);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel this session? No production will be recorded.')) return;
    await post(`/api/sessions/${sessionId}/cancel`);
    navigate('/sessions');
  };

  if (!session) return <div className="text-slate-400 animate-pulse">Loading…</div>;

  const label = session.mode === 'device' ? session.device_name : `${session.cable_type_name} cable`;

  if (result) {
    const m = result.metrics;
    const unit = session.mode === 'device' ? 'devices' : 'feet';
    return (
      <div className="max-w-xl space-y-5">
        <div className="card p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-bold">Production recorded</h1>
          <p className="text-slate-400 text-sm mt-1">{label} · {session.project_number}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={`Total ${unit}`} value={formatNumber(result.quantity, 1)} accent />
          <Stat label="Total labor hours" value={formatNumber(m.totalHours)} />
          <Stat label="Man hours" value={formatNumber(m.manHours)} />
          <Stat label={`Hours per ${session.mode === 'device' ? 'device' : 'foot'}`} value={formatNumber(m.hoursPerUnit, 4)} />
          <Stat label={`${unit} per hour`} value={formatNumber(m.unitsPerHour)} />
          <Stat label={`${unit} per man hour`} value={formatNumber(m.unitsPerManHour)} accent />
        </div>
        <p className="text-center text-xs text-slate-500">This result is now part of the 3DTSI labor intelligence database.</p>
        <button className="btn-primary w-full py-3.5" onClick={() => navigate(`/track/${session.project_id}`)}>Track more work</button>
        <button className="btn-outline w-full py-3" onClick={() => navigate('/sessions')}>My work history</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <div className="text-sm text-slate-400">{session.project_number} · {session.project_name}</div>
        <h1 className="text-2xl font-bold mt-1">{label}</h1>
        <div className="text-sm text-slate-400">{session.task_type_name} · {session.crew_size} technician{session.crew_size > 1 ? 's' : ''}</div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      <div className={`card p-8 text-center ${session.status === 'running' ? 'border-brand-500' : 'border-gold-500'}`}>
        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400 mb-2">
          {session.status === 'running' ? '● Recording' : '❚❚ Paused'}
        </div>
        <div className={`text-6xl font-black tabular-nums ${session.status === 'running' ? 'text-brand-400' : 'text-gold-500'}`}>
          {formatHMS(seconds)}
        </div>
      </div>

      {!completing ? (
        <div className="grid grid-cols-2 gap-3">
          {session.status === 'running' ? (
            <button className="btn-gold py-4 text-lg" disabled={busy} onClick={() => act('pause')}>❚❚ Pause</button>
          ) : (
            <button className="btn-primary py-4 text-lg" disabled={busy} onClick={() => act('resume')}>▶ Resume</button>
          )}
          <button className="btn-danger py-4 text-lg" disabled={busy} onClick={() => setCompleting(true)}>■ Stop</button>
          <button className="btn-outline col-span-2 py-2.5 text-sm" onClick={cancel}>Cancel session (no production)</button>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          {session.mode === 'device' ? (
            <div>
              <label className="label">Total quantity installed</label>
              <input className="input text-center text-3xl font-bold" type="number" inputMode="decimal" min={1} autoFocus value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
              <p className="text-xs text-slate-400 mt-2">Example: 47 horn strobes installed → enter 47</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="label">Remaining footage on each reel</label>
              {session.reels.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 w-28 shrink-0">Reel #{r.reel_number} <span className="text-slate-500">/ {formatNumber(r.starting_length, 0)} ft</span></span>
                  <input className="input" type="number" inputMode="decimal" min={0} max={r.starting_length} value={remaining[r.reel_number] ?? ''} onChange={(e) => setRemaining({ ...remaining, [r.reel_number]: e.target.value })} placeholder="Remaining ft" />
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-outline py-3" onClick={() => setCompleting(false)}>Back</button>
            <button className="btn-primary py-3" disabled={busy} onClick={stop}>Complete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accent ? 'text-gold-500' : 'text-brand-400'}`}>{value}</div>
    </div>
  );
}
