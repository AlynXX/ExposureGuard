import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleVerification, CODE_TTL, SESSION_TTL, sendCode } from '../app/lib/verification.mjs';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_verification.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query) { return { bind(...args) { const stmt = sqlite.prepare(query); return { first: async () => stmt.get(...args) ?? null, run: async () => stmt.run(...args) }; } }; }, batch: async statements => Promise.all(statements.map(s => s.run())) };
  const env = { DB, VERIFICATION_SECRET: 's'.repeat(40), RESEND_API_KEY: 'test', MAIL_FROM: 'security@example.com' };
  let code;
  const dependencies = { now: 100000, mail: async (_, __, value) => { code = value; }, lookup: async identity => ({ status: 'found', breaches: [{ name: identity.email }] }) };
  const post = (action, body, cookie = '', origin = 'https://guard.example') => handleVerification(new Request(`https://guard.example/api/live/${action}`, { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }), env, dependencies);
  const request = async () => { const response = await post('request', { email: 'owner@example.com', consent: true }); assert.equal(response.status, 200); return (await response.json()).challenge; };
  return { env, dependencies, post, request, code: () => code, sqlite };
}
test('unconfigured service and cross-origin requests fail closed', async () => {
  const s = setup();
  assert.equal((await handleVerification(new Request('https://guard.example/api/live/status'), {})).status, 200);
  assert.equal((await s.post('request', {}, '', 'https://other.example')).status, 403);
  s.sqlite.close();
});
test('delivery, verification, cookie session, bound email lookup, logout and replay prevention', async () => {
  const s = setup(); const challenge = await s.request();
  const response = await s.post('verify', { challenge, code: s.code() });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await s.post('verify', { challenge, code: s.code() })).status, 400);
  const lookup = await s.post('check', { email: 'attacker@example.com' }, cookie);
  assert.equal((await lookup.json()).breaches[0].name, 'owner@example.com');
  assert.equal((await s.post('logout', {}, cookie)).status, 200);
  assert.equal((await s.post('check', {}, cookie)).status, 401);
  s.sqlite.close();
});
test('codes expire and five wrong attempts exhaust a challenge', async () => {
  const s = setup(); const challenge = await s.request(); const good = s.code();
  const wrong = good === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await s.post('verify', { challenge, code: wrong })).status, 400);
  assert.equal((await s.post('verify', { challenge, code: good })).status, 400);
  const next = await s.request(); s.dependencies.now += CODE_TTL;
  assert.equal((await s.post('verify', { challenge: next, code: s.code() })).status, 400);
  s.sqlite.close();
});
test('sessions expire and anonymous lookup is rejected', async () => {
  const s = setup(); assert.equal((await s.post('check', {})).status, 401);
  const challenge = await s.request(); const response = await s.post('verify', { challenge, code: s.code() });
  s.dependencies.now += SESSION_TTL;
  assert.equal((await s.post('check', {}, response.headers.get('set-cookie'))).status, 401);
  s.sqlite.close();
});
test('send limit persists and delivery failures invalidate challenge', async () => {
  const s = setup(); for (let i = 0; i < 3; i++) await s.request();
  assert.equal((await s.post('request', { email: 'owner@example.com', consent: true })).status, 429);
  s.dependencies.mail = async () => { throw new Error('provider secret'); };
  assert.equal((await s.post('request', { email: 'other@example.com', consent: true })).status, 503);
  assert.equal(s.sqlite.prepare('SELECT count(*) AS n FROM verification_challenges WHERE email = ?').get('other@example.com').n, 0);
  s.sqlite.close();
});
test('mail transport uses Resend without exposing provider responses', async () => {
  await sendCode({ MAIL_FROM: 'security@example.com', RESEND_API_KEY: 'secret' }, 'owner@example.com', '123456', async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.method, 'POST');
    assert.equal(JSON.parse(init.body).text.includes('123456'), true); return new Response('{}');
  });
});
