/**
 * Lead form endpoint for the portfolio.
 *
 * The page is static, so the form posts here and this function forwards the
 * lead by email through Resend. The API key never reaches the browser: it is
 * read from the environment of the Vercel project.
 *
 * Required environment variables (Vercel > pablo-wib > Settings > Environment
 * Variables), the same three the wib.digital project already uses:
 *   RESEND_API_KEY     the Resend key
 *   RESEND_TO_EMAIL    where leads are delivered
 *   RESEND_FROM_EMAIL  a sender on a domain verified in Resend
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * One instance keeps its memory between invocations while it stays warm, so
 * this stops a burst from a single address. It is not a shared store: another
 * instance starts with an empty map, which is the accepted trade-off for a
 * form that gets a handful of submissions a day.
 */
const HITS = new Map();
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 500) HITS.clear();
  return recent.length > LIMIT;
}

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function body(lead) {
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 0;color:#7C7C79;font:500 12px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;vertical-align:top;width:120px;">${esc(label)}</td>
      <td style="padding:10px 0;color:#0B0B0B;font:400 15px/1.6 system-ui,sans-serif;">${value}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;background:#F4F4F1;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #0B0B0B;padding:32px;">
    <p style="margin:0;color:#7C7C79;font:500 12px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;">New lead &middot; pablo.wib.digital</p>
    <h1 style="margin:12px 0 24px;font:800 28px/1.1 system-ui,sans-serif;color:#0B0B0B;letter-spacing:-.02em;">${esc(lead.name)}</h1>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(11,11,11,.16);">
      ${row('Email', `<a href="mailto:${esc(lead.email)}" style="color:#0B0B0B;">${esc(lead.email)}</a>`)}
      ${row('Budget', esc(lead.budget || 'Not stated'))}
      ${row('Message', esc(lead.message).replace(/\n/g, '<br>'))}
    </table>
    <p style="margin:28px 0 0;">
      <a href="mailto:${esc(lead.email)}?subject=Re:%20your%20project" style="display:inline-block;background:#0B0B0B;color:#F4F4F1;padding:12px 24px;text-decoration:none;font:600 14px system-ui,sans-serif;">Reply</a>
    </p>
  </div>
</body></html>`;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const ip = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    response.status(429).json({ ok: false, error: 'Too many messages. Try again in a while.' });
    return;
  }

  let payload = request.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (!payload || typeof payload !== 'object') {
    response.status(400).json({ ok: false, error: 'Check the form and try again.' });
    return;
  }

  // Honeypot. A bot fills every field it finds, so anything here means the
  // submission is automated. Answer as if it worked and drop it.
  if (String(payload.website || '').trim()) {
    response.status(200).json({ ok: true });
    return;
  }

  const lead = {
    name: String(payload.name || '').trim().slice(0, 80),
    email: String(payload.email || '').trim().slice(0, 120),
    message: String(payload.message || '').trim().slice(0, 2000),
    budget: String(payload.budget || '').trim().slice(0, 40),
  };

  if (lead.name.length < 2 || !EMAIL.test(lead.email) || lead.message.length < 20) {
    // Deliberately vague: the reason a payload failed validation helps whoever
    // is probing the endpoint far more than it helps a visitor.
    response.status(400).json({ ok: false, error: 'Check the form and try again.' });
    return;
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.RESEND_TO_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || 'team@wib.digital';

  if (!key || !to) {
    console.error('[lead] RESEND_API_KEY or RESEND_TO_EMAIL is not set on this project');
    response.status(500).json({ ok: false, error: 'The form is not available right now.' });
    return;
  }

  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Portfolio <${from}>`,
        to: [to],
        reply_to: lead.email,
        subject: `New lead — ${lead.name}`,
        html: body(lead),
      }),
    });

    if (!sent.ok) {
      console.error('[lead] resend responded', sent.status, await sent.text());
      response.status(502).json({ ok: false, error: 'We could not send your message. Try again in a moment.' });
      return;
    }

    response.status(200).json({ ok: true });
  } catch (error) {
    console.error('[lead] failed to send:', error);
    response.status(500).json({ ok: false, error: 'We could not send your message. Try again in a moment.' });
  }
};
