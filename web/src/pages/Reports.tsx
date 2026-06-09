import { useEffect, useState } from 'react';
import { get, downloadCsv } from '../lib/api';
import { formatNumber } from '../lib/format';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual', label: 'Annual' },
];

const GROUPS = [
  { key: 'project', label: 'By Project' },
  { key: 'technician', label: 'By Technician' },
  { key: 'crew', label: 'By Crew' },
  { key: 'customer', label: 'By Customer' },
  { key: 'system', label: 'By System' },
  { key: 'device', label: 'By Device' },
  { key: 'market', label: 'By Market' },
];

export default function Reports() {
  const [period, setPeriod] = useState('weekly');
  const [groupBy, setGroupBy] = useState('project');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get(`/api/reports?period=${period}&groupBy=${groupBy}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e.message));
  }, [period, groupBy]);

  const exportCsv = async (detail = false) => {
    setBusy(true);
    try {
      const path = detail
        ? `/api/reports/detail?period=${period}&format=csv`
        : `/api/reports?period=${period}&groupBy=${groupBy}&format=csv`;
      await downloadCsv(path, `lip-${period}-${detail ? 'detail' : groupBy}.csv`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2 no-print">
          <button className="btn-outline px-3 py-2 text-sm" disabled={busy} onClick={() => exportCsv(false)}>⬇ CSV / Excel</button>
          <button className="btn-outline px-3 py-2 text-sm" disabled={busy} onClick={() => exportCsv(true)}>⬇ Detail CSV</button>
          <button className="btn-gold px-3 py-2 text-sm" onClick={() => window.print()}>🖨 PDF</button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      <div className="flex gap-2 flex-wrap no-print">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-4 py-2 rounded-full text-sm font-semibold ${period === p.key ? 'bg-brand-600 text-white' : 'bg-ink-700 text-slate-300'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap no-print">
        {GROUPS.map((g) => (
          <button key={g.key} onClick={() => setGroupBy(g.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${groupBy === g.key ? 'bg-gold-500 text-ink-900' : 'bg-ink-700 text-slate-300'}`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4 pb-2 hidden print:block">
          <strong>3DTSI Labor Intelligence Platform</strong> - {PERIODS.find((p) => p.key === period)?.label} report {GROUPS.find((g) => g.key === groupBy)?.label}, generated {new Date().toLocaleString()}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-600 text-left text-[11px] uppercase tracking-wider text-slate-400">
              {['Name', 'Sessions', 'Units', 'Man hours', 'Units/MH', 'Earned hrs', 'Variance hrs', 'Productivity'].map((h) => (
                <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink-700 last:border-0">
                <td className="px-4 py-3">{r.label}</td>
                <td className="px-4 py-3">{r.sessions}</td>
                <td className="px-4 py-3">{formatNumber(r.total_units, 0)}</td>
                <td className="px-4 py-3">{formatNumber(r.man_hours, 1)}</td>
                <td className="px-4 py-3">{formatNumber(r.units_per_man_hour)}</td>
                <td className="px-4 py-3">{formatNumber(r.earned_hours, 1)}</td>
                <td className={`px-4 py-3 font-semibold ${(r.labor_variance_hours ?? 0) >= 0 ? 'text-brand-400' : 'text-red-400'}`}>{formatNumber(r.labor_variance_hours, 1)}</td>
                <td className="px-4 py-3 font-semibold">{formatNumber(r.productivity_score, 0)}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No production recorded in this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
