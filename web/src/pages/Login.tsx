import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { post } from '../lib/api';

type Mode = 'signin' | 'mfa' | 'register' | 'verify' | 'forgot' | 'reset' | 'bootstrap';

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setError('');
    setNotice('');
    setCode('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      switch (mode) {
        case 'signin': {
          const res = await login(email, password);
          if (res.mfaRequired) {
            setMfaToken(res.mfaToken!);
            setMode('mfa');
          }
          break;
        }
        case 'mfa':
          await verifyMfa(mfaToken, code);
          break;
        case 'register': {
          const r = await post('/api/auth/register', { email, password, fullName });
          setNotice(r.message);
          setMode(r.verificationRequired === false ? 'signin' : 'verify');
          break;
        }
        case 'verify': {
          const r = await post('/api/auth/verify-email', { email, code });
          setNotice(r.message);
          setMode('signin');
          break;
        }
        case 'forgot': {
          const r = await post('/api/auth/forgot-password', { email });
          setNotice(r.message);
          setMode('reset');
          break;
        }
        case 'reset': {
          const r = await post('/api/auth/reset-password', { email, code, newPassword: password });
          setNotice(r.message);
          setPassword('');
          setMode('signin');
          break;
        }
        case 'bootstrap': {
          await post('/api/auth/bootstrap', { email, password, fullName });
          setNotice('Administrator account created - sign in below.');
          setMode('signin');
          break;
        }
      }
    } catch (err: any) {
      setError(err.message);
      if (err.status === 403 && mode === 'signin' && String(err.message).includes('not verified')) setMode('verify');
    } finally {
      setBusy(false);
    }
  };

  const codeInput = (
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
    </div>
  );

  const emailInput = (
    <div>
      <label className="label">Email</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
        placeholder={mode === 'register' ? 'you@3dtsi.com' : undefined} />
    </div>
  );

  const titles: Record<Mode, string> = {
    signin: 'Sign in',
    mfa: 'Verify',
    register: 'Create account',
    verify: 'Verify email',
    forgot: 'Send reset code',
    reset: 'Set new password',
    bootstrap: 'Create administrator',
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
          {mode === 'mfa' && (
            <>
              {codeInput}
              <p className="text-xs text-slate-400">Enter the 6-digit code from your authenticator app.</p>
            </>
          )}

          {(mode === 'register' || mode === 'bootstrap') && (
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}

          {mode !== 'mfa' && emailInput}

          {(mode === 'signin' || mode === 'register' || mode === 'bootstrap' || mode === 'reset') && (
            <div>
              <label className="label">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={mode === 'signin' ? undefined : 10} />
              {mode === 'register' && <p className="text-xs text-slate-400 mt-1.5">At least 10 characters. Your email must end with @3dtsi.com - a verification code will be sent to it.</p>}
            </div>
          )}

          {(mode === 'verify' || mode === 'reset') && (
            <>
              {codeInput}
              <p className="text-xs text-slate-400">
                Enter the 6-digit code we emailed to {email || 'your address'}.{' '}
                {mode === 'verify' && (
                  <button type="button" className="text-brand-400 underline" onClick={async () => { await post('/api/auth/resend-verification', { email }); setNotice('A new code is on the way.'); }}>
                    Resend code
                  </button>
                )}
              </p>
            </>
          )}

          <button className="btn-primary w-full py-3.5 text-base" disabled={busy}>
            {busy ? 'Please wait…' : titles[mode]}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="mt-5 space-y-2 text-center text-sm">
            <button onClick={() => go('register')} className="text-brand-400 hover:underline">Create account (3DTSI staff)</button>
            <div>
              <button onClick={() => go('forgot')} className="text-slate-400 hover:text-brand-400 text-xs">Forgot password?</button>
              <span className="text-slate-600 text-xs mx-2">·</span>
              <button onClick={() => go('bootstrap')} className="text-slate-500 hover:text-brand-400 text-xs">First-time setup</button>
            </div>
          </div>
        )}
        {mode !== 'signin' && (
          <button onClick={() => go('signin')} className="w-full mt-4 text-xs text-slate-500 hover:text-brand-400">← Back to sign in</button>
        )}
      </div>
    </div>
  );
}
