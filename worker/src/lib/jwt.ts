// Minimal HS256 JWT implementation on WebCrypto.

import { base64UrlEncode, base64UrlDecode } from './crypto';

export interface JwtPayload {
  sub: number;          // user id
  jti: string;          // session id (auth_sessions.id)
  role: string;
  name: string;
  purpose: 'access' | 'mfa';
  iat: number;
  exp: number;
  [k: string]: unknown;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64UrlDecode(parts[2]) as BufferSource,
    new TextEncoder().encode(data),
  );
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
