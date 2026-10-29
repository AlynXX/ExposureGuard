// Server-only transport. Credentials are supplied by runtime secret bindings.
function mailbox(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value) || value.length > 254) {
    throw new Error('MAIL_UNAVAILABLE');
  }
  return value;
}
export function mailProvider(env) {
  return env.MAIL_PROVIDER ?? 'resend';
}
export function mailConfigured(env) {
  if (!env.MAIL_FROM) return false;
  try { mailbox(env.MAIL_FROM); } catch { return false; }
  if (mailProvider(env) === 'gmail') return !!(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN);
  if (mailProvider(env) === 'resend') return !!env.RESEND_API_KEY;
  return false;
}
function base64(value) {
  return btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''));
}
export function createMime(from, to, code) {
  mailbox(from); mailbox(to);
  if (!/^\d{6}$/.test(code)) throw new Error('MAIL_UNAVAILABLE');
  const text = `Kod / Code: ${code}\nWażny przez 10 minut / Valid for 10 minutes.\nNie udostępniaj kodu / Do not share this code.\nJeśli nie prosisz o sprawdzenie wycieków, zignoruj wiadomość. / If you did not request a breach check, ignore this message.`;
  return [
    `From: ExposureGuard <${from}>`, `To: ${to}`,
    'Subject: ExposureGuard - kod weryfikacyjny / verification code',
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '',
    base64(text).match(/.{1,76}/g).join('\r\n'),
  ].join('\r\n');
}
export async function sendCode(env, email, code, fetcher = fetch) {
  try {
    if (!mailConfigured(env)) throw new Error();
    const mime = createMime(env.MAIL_FROM, email, code);
    if (mailProvider(env) === 'gmail') {
      const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' }).toString(),
      });
      if (!tokenResponse.ok) throw new Error();
      const token = await tokenResponse.json();
      if (typeof token.access_token !== 'string' || !/^[\x21-\x7e]+$/.test(token.access_token)) throw new Error();
      const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store',
        headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }),
      });
      if (!response.ok || typeof (await response.json()).id !== 'string') throw new Error();
      return;
    }
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'ExposureGuard - kod weryfikacyjny / verification code', text: `Kod / Code: ${code}\nWażny przez 10 minut / Valid for 10 minutes.\nNie udostępniaj kodu / Do not share this code.\nJeśli nie prosisz o sprawdzenie wycieków, zignoruj wiadomość. / If you did not request a breach check, ignore this message.` }),
    });
    if (!response.ok) throw new Error();
  } catch {
    // OAuth/mail response bodies can contain sensitive details. Never propagate them.
    throw new Error('MAIL_UNAVAILABLE');
  }
}
