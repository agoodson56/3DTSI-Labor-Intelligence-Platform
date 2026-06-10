// Outbound email via the Resend API (https://resend.com).
// Configure with: wrangler secret put RESEND_API_KEY
// Sender address comes from the EMAIL_FROM var in wrangler.toml.

export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}

export function emailConfigured(env: EmailEnv): boolean {
  return !!env.RESEND_API_KEY;
}

export async function sendEmail(env: EmailEnv, to: string, subject: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? '3DTSI LIP <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error('Email send failed:', res.status, await res.text());
    return false;
  }
  return true;
}

export function codeEmailHtml(title: string, code: string, note: string): string {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;background:#0b1215;color:#e2e8f0;border-radius:16px;padding:32px">
    <div style="text-align:center;font-size:22px;font-weight:800">
      <span style="color:#2fccbf">3D</span><span style="color:#d4af37">&nbsp;LABOR</span>
    </div>
    <div style="text-align:center;font-size:11px;letter-spacing:3px;color:#94a3b8;margin-top:4px">LABOR INTELLIGENCE PLATFORM</div>
    <h2 style="font-size:16px;margin-top:28px;color:#fff">${title}</h2>
    <div style="text-align:center;font-size:36px;font-weight:800;letter-spacing:10px;color:#2fccbf;background:#16252b;border-radius:12px;padding:18px;margin:16px 0">${code}</div>
    <p style="font-size:13px;color:#94a3b8">${note}</p>
  </div>`;
}
