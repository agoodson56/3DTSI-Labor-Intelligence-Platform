import { useEffect, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { get } from '../lib/api';
import { formatNumber } from '../lib/format';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [days, setDays] = useState(90);
  const [error, setError] = useState('');

  useEffect(() => {
    get(`/api/dashboard/summary?days=${days}`).then(setData).catch((e) => setError(e.message));
  }, [days]);

  if (error) return <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>;
  if (!data) return <div className="text-slate-400 animate-pulse">Loading executive dashboard…</div>;

  const k = data.kpis ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
        <select className="input !w-auto !py-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Active projects" value={formatNumber(k.active_projects, 0)} />
        <Kpi label="Sessions recorded" value={formatNumber(k.sessions, 0)} />
        <Kpi label="Man hours" value={formatNumber(k.man_hours, 1)} />
        <Kpi label="Earned hours" value={formatNumber(k.earned_hours, 1)} />
        <Kpi label="Productivity" value={`${formatNumber(k.productivity_score, 0)}%`} highlight={(k.productivity_score ?? 0) >= 100} />
      </div>

      <section className="card p-5">
        <h2 className="font-bold mb-4">Labor & Productivity Trend</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={data.weeklyTrend}>
              <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="h" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="p" orientation="right" stroke="#d4af37" fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: '#101b1f', border: '1px solid #2c4651', borderRadius: 12 }} />
              <Legend />
              <Bar yAxisId="h" dataKey="man_hours" name="Man hours" fill="#0c8a80" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="h" dataKey="earned_hours" name="Earned hours" fill="#2fccbf" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" dataKey="productivity_score" name="Productivity %" stroke="#d4af37" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-5">
        <Leaderboard title="🏆 Top Technicians" rows={data.topTechnicians} metric="productivity_score" suffix="%" />
        <Leaderboard title="👷 Top Crews" rows={data.topCrews} metric="productivity_score" suffix="%" />
        <Leaderboard title="📋 Top Project Managers" rows={data.topProjectManagers} metric="productivity_score" suffix="%" />
        <Leaderboard title="🏢 Offices" rows={data.offices} metric="productivity_score" suffix="%" />
      </div>

      <section className="card p-5">
        <h2 className="font-bold mb-1">Systems: Most → Least Profitable Labor</h2>
        <p className="text-xs text-slate-400 mb-4">Productivity above 100% means field crews are beating the estimating database.</p>
        <div className="space-y-2">
          {(data.systems ?? []).map((s: any) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-36 text-sm shrink-0 truncate">{s.label}</div>
              <div className="flex-1 h-6 bg-ink-700 rounded-full overflow-hidden">
                <div className={`h-full ${(s.productivity_score ?? 0) >= 100 ? 'bg-brand-500' : 'bg-red-500/80'}`} style={{ width: `${Math.min(150, s.productivity_score ?? 0) / 1.5}%` }} />
              </div>
              <div className={`w-20 text-right text-sm font-bold ${(s.productivity_score ?? 0) >= 100 ? 'text-brand-400' : 'text-red-400'}`}>
                {formatNumber(s.productivity_score, 0)}%
              </div>
              <div className="w-24 text-right text-xs text-slate-400 hidden sm:block">{formatNumber(s.labor_variance_hours, 1)} h var</div>
            </div>
          ))}
          {(data.systems ?? []).length === 0 && <div className="text-slate-400 text-sm">No production data in this period yet.</div>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-2xl font-black mt-1 ${highlight ? 'text-gold-500' : 'text-brand-400'}`}>{value}</div>
    </div>
  );
}

function Leaderboard({ title, rows, metric, suffix }: { title: string; rows: any[]; metric: string; suffix?: string }) {
  return (
    <section className="card p-5">
      <h2 className="font-bold mb-3">{title}</h2>
      <div className="space-y-2">
        {(rows ?? []).slice(0, 5).map((r: any, i: number) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-gold-500 text-ink-900' : 'bg-ink-600 text-slate-300'}`}>{i + 1}</span>
            <span className="flex-1 truncate">{r.label}</span>
            <span className="font-bold text-brand-400">{formatNumber(r[metric], 0)}{suffix}</span>
          </div>
        ))}
        {(rows ?? []).length === 0 && <div className="text-slate-400 text-sm">No data yet.</div>}
      </div>
    </section>
  );
}
