import { useEffect, useState } from 'react';
import { get } from '../lib/api';
import { formatNumber } from '../lib/format';

const DIMENSIONS = [
  { key: 'technician', label: 'Technician' },
  { key: 'customer', label: 'Customer' },
  { key: 'market', label: 'Market' },
  { key: 'office', label: 'Office' },
  { key: 'project-type', label: 'Project Type' },
  { key: 'system', label: 'System' },
];

export default function Intelligence() {
  const [tab, setTab] = useState<'rates' | 'cable' | 'crews' | 'insights' | 'dimensions'>('rates');
  const [deviceRates, setDeviceRates] = useState<any[]>([]);
  const [cableRates, setCableRates] = useState<any[]>([]);
  const [crewRates, setCrewRates] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [dimension, setDimension] = useState('technician');
  const [dimensionRows, setDimensionRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      get('/api/intelligence/rates/devices'),
      get('/api/intelligence/rates/cable'),
      get('/api/intelligence/rates/crew-size'),
      get('/api/intelligence/insights'),
    ])
      .then(([d, c, cr, ins]) => {
        setDeviceRates(d);
        setCableRates(c);
        setCrewRates(cr);
        setInsights(ins);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    get(`/api/intelligence/rates/by/${dimension}`).then(setDimensionRows).catch((e) => setError(e.message));
  }, [dimension]);

  const tabs = [
    { key: 'rates', label: 'Device Rates' },
    { key: 'cable', label: 'Cable Rates' },
    { key: 'crews', label: 'Crew Sizes' },
    { key: 'dimensions', label: 'Breakdowns' },
    { key: 'insights', label: `AI Insights${insights ? ` (${insights.count})` : ''}` },
  ] as const;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Labor Intelligence</h1>
      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-ink-700 text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rates' && (
        <Table
          headers={['System', 'Device', 'Samples', 'Actual hrs/unit', 'Estimate hrs/unit', 'Variance', 'Units/man-hr', 'Confidence']}
          rows={deviceRates.map((r) => [
            r.system,
            r.device,
            r.samples,
            formatNumber(r.actual_hours_per_unit, 3),
            formatNumber(r.estimate_rate, 3),
            <Variance key="v" pct={r.variance_pct} />,
            formatNumber(r.units_per_man_hour),
            <Confidence key="c" level={r.confidence} />,
          ])}
          empty="No completed device sessions yet - rates appear as technicians record work."
        />
      )}

      {tab === 'cable' && (
        <Table
          headers={['Cable type', 'Samples', 'Total feet', 'Feet/hour', 'Feet/man-hour', 'Hours/foot', 'Confidence']}
          rows={cableRates.map((r) => [
            r.cable_type,
            r.samples,
            formatNumber(r.total_feet, 0),
            formatNumber(r.feet_per_hour, 1),
            formatNumber(r.feet_per_man_hour, 1),
            formatNumber(r.hours_per_foot, 4),
            <Confidence key="c" level={r.confidence} />,
          ])}
          empty="No completed cable sessions yet."
        />
      )}

      {tab === 'crews' && (
        <Table
          headers={['Crew size', 'Samples', 'Total units', 'Units/man-hour', 'Units/hour', 'Confidence']}
          rows={crewRates.map((r) => [
            `${r.crew_size}-person`,
            r.samples,
            formatNumber(r.total_units, 0),
            formatNumber(r.units_per_man_hour),
            formatNumber(r.units_per_hour),
            <Confidence key="c" level={r.confidence} />,
          ])}
          empty="No crew data yet."
        />
      )}

      {tab === 'dimensions' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {DIMENSIONS.map((d) => (
              <button key={d.key} onClick={() => setDimension(d.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${dimension === d.key ? 'bg-gold-500 text-ink-900' : 'bg-ink-700 text-slate-300'}`}>
                {d.label}
              </button>
            ))}
          </div>
          <Table
            headers={[DIMENSIONS.find((d) => d.key === dimension)?.label ?? '', 'Samples', 'Total units', 'Man hours', 'Units/man-hr', 'Productivity']}
            rows={dimensionRows.map((r) => [
              r.label,
              r.samples,
              formatNumber(r.total_units, 0),
              formatNumber(r.total_man_hours, 1),
              formatNumber(r.units_per_man_hour),
              `${formatNumber(r.productivity_score, 0)}%`,
            ])}
            empty="No data for this breakdown yet."
          />
        </>
      )}

      {tab === 'insights' && (
        <div className="space-y-3">
          {insights?.insights?.map((ins: any, i: number) => (
            <div key={i} className={`card p-4 border-l-4 ${ins.severity === 'warning' ? 'border-l-red-500' : ins.severity === 'opportunity' ? 'border-l-gold-500' : 'border-l-brand-500'}`}>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                {ins.severity === 'warning' ? '⚠️ Warning' : ins.severity === 'opportunity' ? '💡 Opportunity' : 'ℹ️ Insight'} · {ins.type.replace(/_/g, ' ')}
              </div>
              <div className="text-sm text-slate-100">{ins.message}</div>
            </div>
          ))}
          {(insights?.insights?.length ?? 0) === 0 && (
            <div className="card p-8 text-center text-slate-400">
              The AI analytics engine needs at least 5 completed sessions per device to generate recommendations. Keep recording field work.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows, empty }: { headers: string[]; rows: any[][]; empty: string }) {
  if (rows.length === 0) return <div className="card p-8 text-center text-slate-400">{empty}</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-600 text-left text-[11px] uppercase tracking-wider text-slate-400">
            {headers.map((h) => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ink-700 last:border-0">
              {r.map((cell, j) => <td key={j} className="px-4 py-3 whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Variance({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-slate-500">-</span>;
  // negative = actuals beat estimate (good)
  return <span className={pct <= 0 ? 'text-brand-400 font-bold' : 'text-red-400 font-bold'}>{pct > 0 ? '+' : ''}{pct}%</span>;
}

function Confidence({ level }: { level: string }) {
  const styles: Record<string, string> = {
    high: 'bg-brand-900 text-brand-300 border-brand-700',
    medium: 'bg-gold-500/10 text-gold-400 border-gold-600/40',
    low: 'bg-ink-700 text-slate-400 border-ink-500',
  };
  return <span className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${styles[level] ?? styles.low}`}>{level}</span>;
}
