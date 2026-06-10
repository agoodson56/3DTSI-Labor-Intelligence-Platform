import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);
  const [fullName, setFullName] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (bootstrap) {
        await post('/api/auth/bootstrap', { email, password, fullName });
        setBootstrap(false);
        setNotice('Administrator account created - sign in below.');
      } else if (mfaToken) {
        await verifyMfa(mfaToken, code);
      } else {
        const res = await login(email, password);
        if (res.mfaRequired) setMfaToken(res.mfaToken!);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,rgba(12,138,128,0.25),transparent_60%)]">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="3D Labor" className="w-36 h-36 mx-auto rounded-3xl shadow-lg shadow-black/40" />
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400 mt-4">Labor Intelligence Platform</div>
        </div>

        {notice && <div className="mb-4 p-3 rounded-xl bg-brand-900/60 border border-brand-700 text-brand-200 text-sm">{notice}</div>}
        {error && <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {mfaToken ? (
            <div>
              <label className="label">Verification code</label>
              <input
                className="input text-center text-2xl tracking-[0.5em]"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
              <p className="text-xs text-slate-400 mt-2">Enter the 6-digit code from your authenticator app.</p>
            </div>
          ) : (
            <>
              {bootstrap && (
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
            </>
          )}
          <button className="btn-primary w-full py-3.5 text-base" disabled={busy}>
            {busy ? 'Please wait…' : mfaToken ? 'Verify' : bootstrap ? 'Create administrator' : 'Sign in'}
          </button>
        </form>

        {!mfaToken && (
          <button onClick={() => { setBootstrap(!bootstrap); setError(''); }} className="w-full mt-4 text-xs text-slate-500 hover:text-brand-400">
            {bootstrap ? 'Back to sign in' : 'First-time setup: create administrator'}
          </button>
        )}
      </div>
    </div>
  );
}
