import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, randomHex, base64UrlEncode, base64UrlDecode } from '../src/lib/crypto';
import { signJwt, verifyJwt, type JwtPayload } from '../src/lib/jwt';
import { generateTotpSecret, totpCode, verifyTotp, base32Encode, base32Decode } from '../src/lib/totp';
import { hasPermission, parsePermissions } from '../src/lib/rbac';

const SECRET = 'test-secret-test-secret-test-secret-test-secret-1234567890abcdef';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const { hash, salt } = await hashPassword('CorrectHorseBattery1!');
    expect(await verifyPassword('CorrectHorseBattery1!', salt, hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { hash, salt } = await hashPassword('CorrectHorseBattery1!');
    expect(await verifyPassword('wrong-password', salt, hash)).toBe(false);
  });

  it('produces unique salts', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('jwt', () => {
  const payload = (): JwtPayload => ({
    sub: 1,
    jti: randomHex(16),
    role: 'Technician',
    name: 'Test User',
    purpose: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  it('round-trips a valid token', async () => {
    const token = await signJwt(payload(), SECRET);
    const decoded = await verifyJwt(token, SECRET);
    expect(decoded?.sub).toBe(1);
    expect(decoded?.purpose).toBe('access');
  });

  it('rejects a tampered token', async () => {
    const token = await signJwt(payload(), SECRET);
    const [h, b, s] = token.split('.');
    const tampered = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    tampered.role = 'Administrator';
    const evil = `${h}.${base64UrlEncode(JSON.stringify(tampered))}.${s}`;
    expect(await verifyJwt(evil, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const p = payload();
    p.exp = Math.floor(Date.now() / 1000) - 10;
    const token = await signJwt(p, SECRET);
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signJwt(payload(), 'other-secret-other-secret-other-secret-other-secret');
    expect(await verifyJwt(token, SECRET)).toBeNull();
  });
});

describe('totp', () => {
  it('verifies the current code', async () => {
    const secret = generateTotpSecret();
    const code = await totpCode(secret);
    expect(await verifyTotp(secret, code)).toBe(true);
  });

  it('accepts the previous window (clock drift)', async () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const prev = await totpCode(secret, now - 30_000);
    expect(await verifyTotp(secret, prev, now)).toBe(true);
  });

  it('rejects a wrong code', async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotp(secret, '000000')).toBe(false);
  });

  it('rejects malformed codes', async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotp(secret, 'abcdef')).toBe(false);
    expect(await verifyTotp(secret, '12345')).toBe(false);
  });

  it('base32 round-trips', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
  });

  it('matches RFC 6238 SHA-1 test vector', async () => {
    // RFC 6238 Appendix B: secret "12345678901234567890", T=59s -> 94287082 (8 digit) -> 287082 (6 digit)
    const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
    expect(await totpCode(secret, 59_000)).toBe('287082');
  });
});

describe('base64url', () => {
  it('round-trips binary data', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(33));
    expect(Array.from(base64UrlDecode(base64UrlEncode(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('rbac', () => {
  it('wildcard grants everything', () => {
    expect(hasPermission(['*'], 'users.manage')).toBe(true);
  });

  it('explicit permission grants', () => {
    expect(hasPermission(['sessions.create'], 'sessions.create')).toBe(true);
  });

  it('missing permission denies', () => {
    expect(hasPermission(['sessions.create'], 'users.manage')).toBe(false);
  });

  it('parsePermissions tolerates bad JSON', () => {
    expect(parsePermissions('not json')).toEqual([]);
    expect(parsePermissions('{"a":1}')).toEqual([]);
    expect(parsePermissions('["a","b"]')).toEqual(['a', 'b']);
  });
});
