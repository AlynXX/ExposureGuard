import { checkVerifiedEmail, normalizeEmail } from './breachProvider.mjs';

export const CODE_TTL = 10 * 60_000;
export const SESSION_TTL = 15 * 60_000;
const encoder = new TextEncoder();
export async function digest(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function generateCode() {
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= 4294000000);
  return String(data[0] % 1000000).padStart(6, '0');
}
export async function sendCode(env, email, code, fetcher = fetch) {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'ExposureGuard — kod weryfikacyjny / verification code', text: `Kod / Code: ${code}\nWażny przez 10 minut / Valid for 10 minutes.\nNie udostępniaj kodu / Do not share this code.\nJeśli nie prosisz o sprawdzenie wycieków, zignoruj wiadomość. / If you did not request a breach check, ignore this message.` }),
  });
  if (!response.ok) throw new Error('MAIL_UNAVAILABLE');
}
function reply(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
}
export async function handleVerification(request, env, dependencies = {}) {
  const ready = !!(env.DB && env.RESEND_API_KEY && env.MAIL_FROM && env.VERIFICATION_SECRET?.length >= 32);
  const url = new URL(request.url);
  if (url.pathname === '/api/live/status' && request.method === 'GET') return reply({ available: ready });
  if (!ready) return reply({ error: 'NOT_CONFIGURED' }, 503);
  if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (request.headers.get('origin') !== url.origin) return reply({ error: 'ORIGIN_REJECTED' }, 403);
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return reply({ error: 'INVALID_REQUEST' }, 400);
  const now = dependencies.now ?? Date.now();
  const db = env.DB;
  const sql = (query, ...args) => db.prepare(query).bind(...args);
  const limit = async (key, maximum, window) => {
    const bucket = `${key}:${Math.floor(now / window)}`;
    const row = await sql('INSERT INTO verification_limits (id, count, expires) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count = count + 1 RETURNING count', bucket, now + window).first();
    if (row.count > maximum) throw new Error('RATE_LIMITED');
  };
  try {
    if (Number(request.headers.get('content-length')) > 2048) return reply({ error: 'INVALID_REQUEST' }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return reply({ error: 'INVALID_REQUEST' }, 413);
    const body = JSON.parse(raw);
    await db.batch([
      sql('DELETE FROM verification_challenges WHERE expires <= ?', now),
      sql('DELETE FROM verification_sessions WHERE expires <= ?', now),
      sql('DELETE FROM verification_limits WHERE expires <= ?', now),
    ]);
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    await limit('ip:' + await digest(env.VERIFICATION_SECRET, ip), 30, 3600_000);
    if (url.pathname === '/api/live/request') {
      const email = normalizeEmail(body.email);
      if (body.consent !== true) return reply({ error: 'CONSENT_REQUIRED' }, 400);
      await limit('send:global', 50, 86400_000);
      await limit('send:' + await digest(env.VERIFICATION_SECRET, email.toLowerCase()), 3, 3600_000);
      const challenge = crypto.randomUUID();
      const code = generateCode();
      const hash = await digest(env.VERIFICATION_SECRET, `${challenge}:${code}`);
      await sql('INSERT INTO verification_challenges (id, email, code_hash, attempts, expires) VALUES (?, ?, ?, 0, ?)', challenge, email, hash, now + CODE_TTL).run();
      try { await (dependencies.mail ?? sendCode)(env, email, code); }
      catch { await sql('DELETE FROM verification_challenges WHERE id = ?', challenge).run(); return reply({ error: 'MAIL_UNAVAILABLE' }, 503); }
      return reply({ challenge, expiresIn: CODE_TTL / 1000 });
    }
    if (url.pathname === '/api/live/verify') {
      if (typeof body.challenge !== 'string' || !/^\d{6}$/.test(body.code)) return reply({ error: 'INVALID_CODE' }, 400);
      const row = await sql('UPDATE verification_challenges SET attempts = attempts + 1 WHERE id = ? AND expires > ? AND attempts < 5 RETURNING *', body.challenge, now).first();
      if (!row || row.code_hash !== await digest(env.VERIFICATION_SECRET, `${body.challenge}:${body.code}`)) return reply({ error: 'INVALID_CODE' }, 400);
      // DELETE RETURNING ensures concurrent correct requests cannot reuse the code.
      const consumed = await sql('DELETE FROM verification_challenges WHERE id = ? RETURNING id', body.challenge).first();
      if (!consumed) return reply({ error: 'INVALID_CODE' }, 400);
      const token = crypto.randomUUID() + crypto.randomUUID();
      await sql('INSERT INTO verification_sessions (id, email, expires) VALUES (?, ?, ?)', await digest(env.VERIFICATION_SECRET, token), row.email, now + SESSION_TTL).run();
      return reply({ verified: true, expiresIn: SESSION_TTL / 1000 }, 200, { 'Set-Cookie': `eg_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/live; Max-Age=900` });
    }
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)eg_session=([a-z0-9-]{72})/)?.[1];
    if (!token) return reply({ error: 'VERIFICATION_REQUIRED' }, 401);
    const sessionId = await digest(env.VERIFICATION_SECRET, token);
    if (url.pathname === '/api/live/logout') {
      await sql('DELETE FROM verification_sessions WHERE id = ?', sessionId).run();
      return reply({ loggedOut: true }, 200, { 'Set-Cookie': 'eg_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/live; Max-Age=0' });
    }
    if (url.pathname !== '/api/live/check') return reply({ error: 'NOT_FOUND' }, 404);
    const session = await sql('SELECT email, expires FROM verification_sessions WHERE id = ? AND expires > ?', sessionId, now).first();
    if (!session) return reply({ error: 'VERIFICATION_REQUIRED' }, 401);
    await limit('lookup:global', 20, 3600_000);
    await limit('lookup:daily', 90, 86400_000);
    await limit('lookup:' + sessionId, 1, 60_000);
    const result = await (dependencies.lookup ?? checkVerifiedEmail)({ email: session.email, verified: true, expiresAt: session.expires }, { now });
    return reply(result);
  } catch (error) {
    const code = error?.code ?? error?.message;
    if (code === 'RATE_LIMITED') return reply({ error: code }, 429, { 'Retry-After': '60' });
    if (code === 'INVALID_EMAIL' || error instanceof SyntaxError) return reply({ error: 'INVALID_REQUEST' }, 400);
    return reply({ error: 'SERVICE_UNAVAILABLE' }, 503);
  }
}
