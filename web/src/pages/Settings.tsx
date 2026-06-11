import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { parseDbDate } from '../lib/format';

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    get('/api/auth/me/login-history').then(setHistory).catch(() => {});
    get('/api/auth/me/sessions').then(setSessions).catch(() => {});
  }, []);

  const startMfa = async () => {
    setErr('');
    setMfaSetup(await post('/api/auth/mfa/setup'));
  };

  const enableMfa = async () => {
    setErr('');
    try {
      await post('/api/auth/mfa/enable', { code });
      setMfaSetup(null);
      setCode('');
      setMsg('MFA enabled. You will be asked for a code at every sign-in.');
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const changePassword = async () => {
    setErr('');
    setMsg('');
    try {
      await post('/api/auth/me/password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '' });
      setMsg('Password updated.');
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold">Account & Security</h1>
      {msg && <div className="p-3 rounded-xl bg-brand-900/60 border border-brand-700 text-brand-200 text-sm">{msg}</div>}
      {err && <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{err}</div>}

      <div className="card p-5">
        <div className="font-bold">{user?.fullName}</div>
        <div className="text-sm text-slate-400">{user?.email} · <span className="text-gold-500">{user?.role}</span>{user?.officeLocation ? ` · ${user.officeLocation}` : ''}</div>
        <button className="btn-outline px-4 py-2 text-sm mt-3" onClick={logout}>Sign out</button>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-bold">Multi-factor authentication {user?.mfaEnabled && <span className="text-brand-400 text-sm">✓ enabled</span>}</h2>
        {!user?.mfaEnabled && !mfaSetup && (
          <>
            <p className="text-sm text-slate-400">Protect your account with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
            <button className="btn-gold px-4 py-2.5 text-sm" onClick={startMfa}>Set up MFA</button>
          </>
        )}
        {mfaSetup && (
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-xl text-center">
              <img className="mx-auto" width={180} height={180} alt="MFA QR code"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaSetup.otpauth)}`} />
              <div className="text-ink-900/70 text-[11px] break-all mt-2">Manual key: {mfaSetup.secret}</div>
            </div>
            <p className="text-sm text-slate-400">Scan with your authenticator app, then enter the 6-digit code to confirm.</p>
            <div className="flex gap-2">
              <input className="input text-center tracking-[0.4em]" maxLength={6} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
              <button className="btn-primary px-5 shrink-0" onClick={enableMfa}>Enable</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="font-bold">Change password</h2>
        <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <input className="input" type="password" placeholder="New password (10+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className="btn-primary px-4 py-2.5 text-sm" onClick={changePassword} disabled={!pw.current || pw.next.length < 10}>Update password</button>
      </div>

      <div className="card p-5">
        <h2 className="font-bold mb-3">Active sessions</h2>
        <div className="space-y-2 text-sm">
          {sessions.map((s) => (
            <div key={s.id} className="flex justify-between text-slate-300">
              <span>{s.device} {s.current ? <span className="text-brand-400 text-xs">(this device)</span> : ''}</span>
              <span className="text-slate-500 text-xs">{s.ip_address} · {parseDbDate(s.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-slate-600">App version: {__BUILD_STAMP__}</div>

      <div className="card p-5">
        <h2 className="font-bold mb-3">Login history</h2>
        <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between">
              <span className={h.success ? 'text-slate-300' : 'text-red-400'}>
                {h.success ? '✓' : '✕'} {h.device}{h.mfa_used ? ' · MFA' : ''}
              </span>
              <span className="text-slate-500 text-xs">{h.ip_address} · {parseDbDate(h.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
