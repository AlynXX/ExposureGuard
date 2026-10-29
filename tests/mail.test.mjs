import test from 'node:test';
import assert from 'node:assert/strict';
import { createMime, mailConfigured, sendCode } from '../app/lib/mail.mjs';
const env = { MAIL_PROVIDER: 'gmail', MAIL_FROM: 'sender@example.com', GMAIL_CLIENT_ID: 'client', GMAIL_CLIENT_SECRET: 'private-client-secret', GMAIL_REFRESH_TOKEN: 'private-refresh-token' };

test('Gmail requires all credentials, unknown providers fail closed', () => {
  assert.equal(mailConfigured(env), true);
  for (const key of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'MAIL_FROM']) assert.equal(mailConfigured({ ...env, [key]: '' }), false);
  assert.equal(mailConfigured({ ...env, MAIL_PROVIDER: 'typo', RESEND_API_KEY: 'fallback' }), false);
});
test('refreshes OAuth token then sends base64url MIME with UTF-8 body', async () => {
  const calls = [];
  await sendCode(env, 'recipient@example.com', '123456', async (url, init) => {
    calls.push(url);
    assert.equal(init.redirect, 'error');
    if (url === 'https://oauth2.googleapis.com/token') {
      const body = new URLSearchParams(init.body);
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('refresh_token'), env.GMAIL_REFRESH_TOKEN);
      return Response.json({ access_token: 'access-token' });
    }
    assert.equal(init.headers.Authorization, 'Bearer access-token');
    const { raw } = JSON.parse(init.body);
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, 'base64url').toString('utf8');
    assert.match(mime, /To: recipient@example.com\r\n/);
    const text = Buffer.from(mime.split('\r\n\r\n')[1], 'base64').toString('utf8');
    assert.match(text, /123456/); assert.match(text, /Ważny przez 10 minut/);
    assert.equal(mime.includes(env.GMAIL_REFRESH_TOKEN), false);
    return Response.json({ id: 'message-id' });
  });
  assert.equal(calls.length, 2);
});
test('token rejection never sends mail or exposes secrets', async () => {
  let calls = 0;
  await assert.rejects(sendCode(env, 'recipient@example.com', '123456', async () => { calls++; return Response.json({ error: env.GMAIL_REFRESH_TOKEN }, { status: 400 }); }), { message: 'MAIL_UNAVAILABLE' });
  assert.equal(calls, 1);
});
test('malformed tokens and send failures produce sanitised errors', async () => {
  for (const token of [{}, { access_token: '\r\nInjected' }]) {
    await assert.rejects(sendCode(env, 'recipient@example.com', '123456', async () => Response.json(token)), { message: 'MAIL_UNAVAILABLE' });
  }
  let calls = 0;
  await assert.rejects(sendCode(env, 'recipient@example.com', '123456', async () => ++calls === 1 ? Response.json({ access_token: 'token' }) : new Response('', { status: 429 })), { message: 'MAIL_UNAVAILABLE' });
  await assert.rejects(sendCode(env, 'recipient@example.com', '123456', async () => { throw new Error(env.GMAIL_CLIENT_SECRET); }), { message: 'MAIL_UNAVAILABLE' });
});
test('rejects header injection before any provider request', async () => {
  assert.throws(() => createMime(env.MAIL_FROM, 'recipient@example.com\r\nBcc: other@example.com', '123456'));
  await assert.rejects(sendCode({ ...env, MAIL_FROM: 'sender@example.com\nInjected' }, 'recipient@example.com', '123456', () => assert.fail('network called')), { message: 'MAIL_UNAVAILABLE' });
});
