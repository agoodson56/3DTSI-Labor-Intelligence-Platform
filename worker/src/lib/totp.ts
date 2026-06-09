// RFC 6238 TOTP (SHA-1, 6 digits, 30s step) for MFA. WebCrypto only.

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totpCode(secretBase32: string, timeMs: number = Date.now(), step = 30): Promise<string> {
  const counter = Math.floor(timeMs / 1000 / step);
  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secretBase32) as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes as BufferSource));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]) % 1_000_000;
  return code.toString().padStart(6, '0');
}

/** Accepts current, previous, and next 30s windows for clock drift. */
export async function verifyTotp(secretBase32: string, code: string, timeMs: number = Date.now()): Promise<boolean> {
  const candidate = code.trim();
  if (!/^\d{6}$/.test(candidate)) return false;
  for (const drift of [0, -30_000, 30_000]) {
    if ((await totpCode(secretBase32, timeMs + drift)) === candidate) return true;
  }
  return false;
}

export function otpauthUrl(secretBase32: string, email: string): string {
  const issuer = encodeURIComponent('3DTSI LIP');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
