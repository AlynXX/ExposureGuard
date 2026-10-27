import assert from 'node:assert/strict';
import test from 'node:test';
import { checkVerifiedEmail, normalizeEmail } from '../app/lib/breachProvider.mjs';

const now = Date.UTC(2026, 9, 27);
const identity = { email: 'User+tag@EXAMPLE.COM', verified: true, expiresAt: now + 60_000 };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const run = fetcher => checkVerifiedEmail(identity, { now, fetcher });

test('normalises only domain and rejects path injection', () => {
  assert.equal(normalizeEmail(' User+tag@EXAMPLE.COM '), 'User+tag@example.com');
  for (const value of ['bad', 'a/b@example.com', 'a@example.com?x=1', null]) {
    assert.throws(() => normalizeEmail(value), { code: 'INVALID_EMAIL' });
  }
});

test('requires a current trusted verification before network access', async () => {
  for (const value of [null, { ...identity, verified: false }, { ...identity, expiresAt: now }, { ...identity, expiresAt: undefined }]) {
    await assert.rejects(checkVerifiedEmail(value, { now, fetcher: () => assert.fail('network called') }), { code: 'VERIFICATION_REQUIRED' });
  }
});

test('encodes email, disables caching, deduplicates names without inventing details', async () => {
  const result = await run(async (url, init) => {
    assert.equal(url, 'https://api.xposedornot.com/v1/check-email/User%2Btag%40example.com');
    assert.equal(init.cache, 'no-store');
    return json({ breaches: [['Example', 'Example', 'Other']], email: identity.email });
  });
  assert.equal(result.status, 'found');
  assert.deepEqual(result.breaches, [{ name: 'Example' }, { name: 'Other' }]);
  assert.equal(result.coverage, 'partial');
  assert.equal(JSON.stringify(result).includes(identity.email), false);
});

test('only documented not-found responses produce a missing result', async () => {
  for (const status of [200, 404]) assert.equal((await run(async () => json({ Error: 'Not found', email: null }, status))).status, 'not_found');
  await assert.rejects(run(async () => json({}, 404)), { code: 'INVALID_RESPONSE' });
});

test('distinguishes rate limits, server failure, malformed JSON and schema changes', async () => {
  await assert.rejects(run(async () => json({}, 429, { 'retry-after': '30' })), { code: 'RATE_LIMITED', retryAfterSeconds: 30 });
  await assert.rejects(run(async () => json({}, 503)), { code: 'PROVIDER_UNAVAILABLE' });
  for (const body of [{}, { breaches: [] }, { breaches: [['']] }, { breaches: 'changed' }]) {
    await assert.rejects(run(async () => json(body)), { code: 'INVALID_RESPONSE' });
  }
  await assert.rejects(run(async () => new Response('<html>')), { code: 'INVALID_RESPONSE' });
});

test('timeout and network failures never become not-found results or expose addresses', async () => {
  await assert.rejects(checkVerifiedEmail(identity, { now, timeoutMs: 5, fetcher: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error(identity.email)))) }), { code: 'TIMEOUT' });
  await assert.rejects(run(async () => { throw new Error(identity.email); }), error => error.code === 'PROVIDER_UNAVAILABLE' && !error.message.includes(identity.email));
});
