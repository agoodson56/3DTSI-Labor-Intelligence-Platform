import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../lib/api';

interface Project {
  id: number;
  project_number: string;
  name: string;
  customer_name: string;
  site_address: string;
  market_segment: string;
  status: string;
}

export default function ProjectSelect() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    get<Project[]>('/api/projects?status=active').then(setProjects).catch((e) => setError(e.message));
    return stopScan;
  }, []);

  const stopScan = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const startScan = async () => {
    setError('');
    if (!('BarcodeDetector' in window)) {
      setError('QR scanning is not supported on this device/browser - search for the project instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async function tick() {
        if (!streamRef.current || !videoRef.current) return;
        if (!videoRef.current.srcObject) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const token = String(codes[0].rawValue).split('/').pop();
            const project = await get<any>(`/api/projects/qr/${token}`);
            stopScan();
            navigate(`/track/${project.id}`);
            return;
          }
        } catch {
          /* keep scanning */
        }
        requestAnimationFrame(tick);
      });
    } catch {
      setError('Camera access was denied.');
      stopScan();
    }
  };

  const filtered = projects.filter(
    (p) =>
      !search ||
      `${p.project_number} ${p.name} ${p.customer_name}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Select Project</h1>
        <button className="btn-gold px-4 py-2.5 text-sm" onClick={scanning ? stopScan : startScan}>
          {scanning ? 'Stop' : '📷 Scan QR'}
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

      {scanning && (
        <div className="card overflow-hidden">
          <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline />
          <div className="p-3 text-center text-sm text-slate-400">Point the camera at the project QR code</div>
        </div>
      )}

      <input className="input" placeholder="Search by project #, name, or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-3">
        {filtered.map((p) => (
          <button key={p.id} onClick={() => navigate(`/track/${p.id}`)} className="card w-full text-left p-4 hover:border-brand-500 transition">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-100">
                  <span className="text-brand-400">{p.project_number}</span> · {p.name}
                </div>
                <div className="text-sm text-slate-400 mt-0.5">{p.customer_name}</div>
                {p.site_address && <div className="text-xs text-slate-500 mt-1">📍 {p.site_address}</div>}
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-brand-900 text-brand-300 border border-brand-700 rounded-full px-2.5 py-1">
                {p.market_segment}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <div className="card p-8 text-center text-slate-400">No active projects found. Ask a project manager to add one in Admin.</div>}
      </div>
    </div>
  );
}
