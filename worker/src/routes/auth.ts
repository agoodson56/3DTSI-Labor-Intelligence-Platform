import { Hono } from 'hono';
import { hashPassword, verifyPassword, randomHex } from '../lib/crypto';
import { signJwt, verifyJwt } from '../lib/jwt';
import { generateTotpSecret, verifyTotp, otpauthUrl } from '../lib/totp';
import { emailConfigured, sendEmail, codeEmailHtml } from '../lib/email';
import { requireAuth, clientIp, deviceFromUserAgent, audit } from '../middleware';
import type { AppContext } from '../types';

const auth = new Hono<AppContext>();

const REGISTRATION_DOMAIN = '@3dtsi.com';

function sixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

function sessionMinutes(envValue: string): number {
  const n = parseInt(envValue, 10);
  return Number.isFinite(n) && n > 0 ? n : 480;
}

async function issueAccessToken(c: any, user: any, mfaUsed: boolean) {
  const jti = randomHex(16);
  const minutes = sessionMinutes(c.env.SESSION_TIMEOUT_MINUTES);
  const now = Math.floor(Date.now() / 1000);
  const ua = c.req.header('User-Agent') ?? '';

  await c.env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, ip_address, user_agent, device, expires_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '+' || ? || ' minutes'))`,
  )
    .bind(jti, user.id, clientIp(c), ua, deviceFromUserAgent(ua), minutes)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO login_history (user_id, email, success, mfa_used, ip_address, user_agent, device)
     VALUES (?, ?, 1, ?, ?, ?, ?)`,
  )
    .bind(user.id, user.email, mfaUsed ? 1 : 0, clientIp(c), ua, deviceFromUserAgent(ua))
    .run();

  const token = await signJwt(
    {
      sub: user.id,
      jti,
      role: user.role_name,
      name: user.full_name,
      purpose: 'access',
      iat: now,
      exp: now + minutes * 60,
    },
    c.env.JWT_SECRET,
  );
  return { token, expiresInMinutes: minutes };
}

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role_name,
    permissions: JSON.parse(u.permissions ?? '[]'),
    officeLocation: u.office_location,
    mfaEnabled: !!u.mfa_enabled,
  };
}

const USER_QUERY = `SELECT u.*, r.name AS role_name, r.permissions FROM users u JOIN roles r ON r.id = u.role_id`;

/** One-time first-run setup: creates the initial Administrator when no users exist. */
auth.post('/bootstrap', async (c) => {
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>();
  if ((count?.n ?? 0) > 0) return c.json({ error: 'Already initialized' }, 409);

  const body = await c.req.json<{ email: string; password: string; fullName: string }>();
  if (!body.email || !body.password || body.password.length < 10 || !body.fullName) {
    return c.json({ error: 'email, fullName, and a password of at least 10 characters are required' }, 400);
  }
  const { hash, salt } = await hashPassword(body.password);
  const role = await c.env.DB.prepare(`SELECT id FROM roles WHERE name = 'Administrator'`).first<{ id: number }>();
  await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, password_salt, full_name, role_id) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(body.email.toLowerCase(), hash, salt, body.fullName, role!.id)
    .run();
  return c.json({ ok: true, message: 'Administrator account created. You can now log in.' });
});

/**
 * Self-registration: 3DTSI staff only (email must end with @3dtsi.com).
 * When outbound email is configured, a 6-digit verification code is required
 * before the first sign-in; without it, accounts activate immediately.
 */
auth.post('/register', async (c) => {
  const b = await c.req.json<{ email: string; password: string; fullName: string }>();
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!email.endsWith(REGISTRATION_DOMAIN)) {
    return c.json({ error: `Registration is limited to 3DTSI staff - your email must end with ${REGISTRATION_DOMAIN}` }, 400);
  }
  if (!b.fullName || !b.password || b.password.length < 10) {
    return c.json({ error: 'Full name and a password of at least 10 characters are required' }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT id, email_verified FROM users WHERE email = ?`).bind(email).first<any>();
  if (existing) {
    return c.json({ error: existing.email_verified ? 'An account with that email already exists - sign in instead.' : 'That email is already registered but not verified - use "Resend code".' }, 409);
  }

  const { hash, salt } = await hashPassword(b.password);
  // Pre-assigned role for this email (set up by an admin), otherwise Technician.
  const pre = await c.env.DB.prepare(`SELECT role_name FROM role_preassignments WHERE email = ?`).bind(email).first<any>();
  const role = await c.env.DB.prepare(`SELECT id FROM roles WHERE name = ?`)
    .bind(pre?.role_name ?? 'Technician')
    .first<{ id: number }>()
    .then(async (r) => r ?? (await c.env.DB.prepare(`SELECT id FROM roles WHERE name = 'Technician'`).first<{ id: number }>()));
  const verificationRequired = emailConfigured(c.env);

  if (verificationRequired) {
    const code = sixDigitCode();
    await c.env.DB.prepare(
      `INSERT INTO users (email, password_hash, password_salt, full_name, role_id, email_verified, verify_code, verify_expires)
       VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now', '+30 minutes'))`,
    )
      .bind(email, hash, salt, b.fullName.trim(), role!.id, code)
      .run();
    await sendEmail(
      c.env,
      email,
      'Verify your 3DTSI LIP account',
      codeEmailHtml('Verify your email', code, 'Enter this code in the app to activate your account. It expires in 30 minutes. If you did not register, ignore this email.'),
    );
    return c.json({ ok: true, verificationRequired: true, message: `Verification code sent to ${email}. Enter it to activate your account.` });
  }

  // No email service configured: activate immediately (domain check only).
  await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, password_salt, full_name, role_id, email_verified)
     VALUES (?, ?, ?, ?, ?, 1)`,
  )
    .bind(email, hash, salt, b.fullName.trim(), role!.id)
    .run();
  return c.json({ ok: true, verificationRequired: false, message: 'Account created - you can sign in now.' });
});

auth.post('/verify-email', async (c) => {
  const { email, code } = await c.req.json<{ email: string; code: string }>();
  const user = await c.env.DB.prepare(
    `SELECT id, verify_code, verify_expires FROM users WHERE email = ? AND email_verified = 0`,
  )
    .bind(String(email ?? '').toLowerCase())
    .first<any>();
  if (!user || !user.verify_code || user.verify_code !== String(code ?? '').trim()) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
  const expired = await c.env.DB.prepare(`SELECT datetime('now') > ? AS expired`).bind(user.verify_expires).first<any>();
  if (expired?.expired) return c.json({ error: 'Verification code expired - request a new one.' }, 400);

  await c.env.DB.prepare(`UPDATE users SET email_verified = 1, verify_code = NULL, verify_expires = NULL WHERE id = ?`)
    .bind(user.id)
    .run();
  return c.json({ ok: true, message: 'Email verified - you can now sign in.' });
});

auth.post('/resend-verification', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? AND email_verified = 0`)
    .bind(String(email ?? '').toLowerCase())
    .first<any>();
  // Always respond ok - do not reveal whether an account exists.
  if (user && emailConfigured(c.env)) {
    const code = sixDigitCode();
    await c.env.DB.prepare(`UPDATE users SET verify_code = ?, verify_expires = datetime('now', '+30 minutes') WHERE id = ?`)
      .bind(code, user.id)
      .run();
    await sendEmail(c.env, String(email).toLowerCase(), 'Your 3DTSI LIP verification code',
      codeEmailHtml('Verify your email', code, 'This code expires in 30 minutes.'));
  }
  return c.json({ ok: true, message: 'If that address has a pending registration, a new code is on the way.' });
});

/** Forgot password: emails a 6-digit reset code. */
auth.post('/forgot-password', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? AND active = 1`)
    .bind(String(email ?? '').toLowerCase())
    .first<any>();
  if (user && emailConfigured(c.env)) {
    const code = sixDigitCode();
    await c.env.DB.prepare(`UPDATE users SET reset_code = ?, reset_expires = datetime('now', '+30 minutes') WHERE id = ?`)
      .bind(code, user.id)
      .run();
    await sendEmail(c.env, String(email).toLowerCase(), 'Reset your 3DTSI LIP password',
      codeEmailHtml('Password reset', code, 'Enter this code with your new password. It expires in 30 minutes. If you did not request a reset, you can ignore this email.'));
  }
  return c.json({ ok: true, message: 'If that address has an account, a reset code is on the way.' });
});

auth.post('/reset-password', async (c) => {
  const { email, code, newPassword } = await c.req.json<{ email: string; code: string; newPassword: string }>();
  if (!newPassword || newPassword.length < 10) return c.json({ error: 'New password must be at least 10 characters' }, 400);
  const user = await c.env.DB.prepare(`SELECT id, reset_code, reset_expires FROM users WHERE email = ? AND active = 1`)
    .bind(String(email ?? '').toLowerCase())
    .first<any>();
  if (!user || !user.reset_code || user.reset_code !== String(code ?? '').trim()) {
    return c.json({ error: 'Invalid reset code' }, 400);
  }
  const expired = await c.env.DB.prepare(`SELECT datetime('now') > ? AS expired`).bind(user.reset_expires).first<any>();
  if (expired?.expired) return c.json({ error: 'Reset code expired - request a new one.' }, 400);

  const { hash, salt } = await hashPassword(newPassword);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?, reset_code = NULL, reset_expires = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).bind(hash, salt, user.id),
    // revoke all existing sessions after a reset
    c.env.DB.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?`).bind(user.id),
  ]);
  return c.json({ ok: true, message: 'Password updated - sign in with your new password.' });
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  const ua = c.req.header('User-Agent') ?? '';
  const user = await c.env.DB.prepare(`${USER_QUERY} WHERE u.email = ?`).bind((email ?? '').toLowerCase()).first<any>();

  const ok = user && user.active && (await verifyPassword(password ?? '', user.password_salt, user.password_hash));
  if (!ok) {
    await c.env.DB.prepare(
      `INSERT INTO login_history (user_id, email, success, ip_address, user_agent, device) VALUES (?, ?, 0, ?, ?, ?)`,
    )
      .bind(user?.id ?? null, email ?? '', clientIp(c), ua, deviceFromUserAgent(ua))
      .run();
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (!user.email_verified) {
    return c.json({ error: 'Your email is not verified yet - enter the code we sent you, or use "Resend code".', needsVerification: true }, 403);
  }

  if (user.mfa_enabled) {
    const now = Math.floor(Date.now() / 1000);
    const mfaToken = await signJwt(
      { sub: user.id, jti: randomHex(8), role: user.role_name, name: user.full_name, purpose: 'mfa', iat: now, exp: now + 300 },
      c.env.JWT_SECRET,
    );
    return c.json({ mfaRequired: true, mfaToken });
  }

  const { token, expiresInMinutes } = await issueAccessToken(c, user, false);
  return c.json({ token, expiresInMinutes, user: publicUser(user) });
});

auth.post('/mfa/verify', async (c) => {
  const { mfaToken, code } = await c.req.json<{ mfaToken: string; code: string }>();
  const payload = await verifyJwt(mfaToken ?? '', c.env.JWT_SECRET);
  if (!payload || payload.purpose !== 'mfa') return c.json({ error: 'Invalid or expired MFA token' }, 401);

  const user = await c.env.DB.prepare(`${USER_QUERY} WHERE u.id = ?`).bind(payload.sub).first<any>();
  if (!user || !user.active || !user.mfa_secret) return c.json({ error: 'Invalid account state' }, 401);

  if (!(await verifyTotp(user.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 401);
  }
  const { token, expiresInMinutes } = await issueAccessToken(c, user, true);
  return c.json({ token, expiresInMinutes, user: publicUser(user) });
});

// ---- authenticated endpoints ----
auth.use('/me', requireAuth);
auth.use('/me/*', requireAuth);
auth.use('/logout', requireAuth);
auth.use('/mfa/setup', requireAuth);
auth.use('/mfa/enable', requireAuth);
auth.use('/mfa/disable', requireAuth);

auth.get('/me', async (c) => {
  const u = c.get('user');
  const row = await c.env.DB.prepare(`SELECT mfa_enabled FROM users WHERE id = ?`).bind(u.id).first<any>();
  return c.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.roleName,
    permissions: u.permissions,
    officeLocation: u.officeLocation,
    mfaEnabled: !!row?.mfa_enabled,
  });
});

auth.get('/me/login-history', async (c) => {
  const u = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT success, mfa_used, ip_address, device, user_agent, created_at
     FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
  )
    .bind(u.id)
    .all();
  return c.json(rows.results);
});

auth.get('/me/sessions', async (c) => {
  const u = c.get('user');
  const rows = await c.env.DB.prepare(
    `SELECT id, ip_address, device, created_at, expires_at, revoked,
            CASE WHEN id = ? THEN 1 ELSE 0 END AS current
     FROM auth_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(u.jwt.jti, u.id)
    .all();
  return c.json(rows.results);
});

auth.post('/me/password', async (c) => {
  const u = c.get('user');
  const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
  if (!newPassword || newPassword.length < 10) return c.json({ error: 'New password must be at least 10 characters' }, 400);
  const row = await c.env.DB.prepare(`SELECT password_hash, password_salt FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!(await verifyPassword(currentPassword ?? '', row.password_salt, row.password_hash))) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }
  const { hash, salt } = await hashPassword(newPassword);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(hash, salt, u.id)
    .run();
  await audit(c, 'user.password_change', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/mfa/setup', async (c) => {
  const u = c.get('user');
  const secret = generateTotpSecret();
  await c.env.DB.prepare(`UPDATE users SET mfa_secret = ?, mfa_enabled = 0 WHERE id = ?`).bind(secret, u.id).run();
  return c.json({ secret, otpauth: otpauthUrl(secret, u.email) });
});

auth.post('/mfa/enable', async (c) => {
  const u = c.get('user');
  const { code } = await c.req.json<{ code: string }>();
  const row = await c.env.DB.prepare(`SELECT mfa_secret FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!row?.mfa_secret || !(await verifyTotp(row.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
  await c.env.DB.prepare(`UPDATE users SET mfa_enabled = 1 WHERE id = ?`).bind(u.id).run();
  await audit(c, 'user.mfa_enabled', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/mfa/disable', async (c) => {
  const u = c.get('user');
  const { code } = await c.req.json<{ code: string }>();
  const row = await c.env.DB.prepare(`SELECT mfa_secret FROM users WHERE id = ?`).bind(u.id).first<any>();
  if (!row?.mfa_secret || !(await verifyTotp(row.mfa_secret, code ?? ''))) {
    return c.json({ error: 'Invalid verification code' }, 400);
  }
  await c.env.DB.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?`).bind(u.id).run();
  await audit(c, 'user.mfa_disabled', 'user', u.id);
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  const u = c.get('user');
  await c.env.DB.prepare(`UPDATE auth_sessions SET revoked = 1 WHERE id = ?`).bind(u.jwt.jti).run();
  await audit(c, 'user.logout', 'user', u.id);
  return c.json({ ok: true });
});

export default auth;
