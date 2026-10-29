# Live email verification

The `/api/live/*` Worker endpoints use D1 and a configurable Gmail API or Resend
transport. For domain-free setup see [Gmail instructions in Polish](gmail-setup.pl.md).
Demo codes are never
accepted by this backend. The application keeps the fictional demo available.

## Runtime configuration

Configure these values in Sites runtime environment settings, not in source:

- `MAIL_PROVIDER`: `gmail` or `resend` (default for older deployments).
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`: secrets when
  using Gmail; request only the `gmail.send` scope.
- `RESEND_API_KEY`: secret Resend sending key when using Resend.
- `MAIL_FROM`: authorized Gmail sender or address on a verified Resend domain.
- `VERIFICATION_SECRET`: secret random value of at least 32 characters.

The hosting manifest declares `DB`; Sites provisions D1 and applies the tracked
migration during deployment. For local development apply the SQL migration to
the locally configured D1 database and set the same runtime bindings. Do not
point local tests at the production database.

`GET /api/live/status` returns availability and, when configured, the provider
name. It never returns sender addresses, tokens or configuration values.
Missing configuration disables sending and lookup with HTTP 503.

## Flow

1. `POST /api/live/request` with `{email, consent: true}` sends a random six-digit
   code. Returns an opaque challenge ID and expiration, never the code.
2. `POST /api/live/verify` with `{challenge, code}` consumes a valid code and sets
   an HttpOnly, Secure, SameSite=Strict cookie.
3. `POST /api/live/check` checks the email from the stored session. Client-supplied
   email fields cannot select a different target.
4. `POST /api/live/logout` invalidates the stored session and expires the cookie.

All POST requests require a matching Origin and JSON content type. Codes expire
after ten minutes, allow five attempts and cannot be replayed. Sessions expire
after fifteen minutes. Sending is capped at three per email per hour and fifty
globally per day. Requests are capped at thirty per IP per hour. Lookups are
capped at one per session per minute, twenty globally per hour and ninety per
day. These counters persist in D1 and use atomic SQL updates.

The server stores email addresses temporarily with challenges and sessions;
codes and session tokens are stored only as keyed HMAC digests. Rate-limit keys
use keyed digests instead of plain IP/email values. Expired records are removed
on subsequent configured POST requests, so physical deletion can occur later
than expiry while the application is idle. The configured mail provider (Google
or Resend) receives the recipient address
and message; XposedOrNot receives the address only after verification and an
explicit check. Provider retention is governed by each provider's policy.

## Verification

`npm test` runs offline provider tests, SQLite-backed endpoint tests, production
build and SSR checks. Tests use an in-memory SQLite database and mocked mail and
breach providers. No real emails are sent by tests. Real delivery needs a final
smoke test after the owner configures the sender and runtime secrets.

References: https://resend.com/docs/api-reference/emails/send-email and
https://xposedornot.com/api_doc (checked 2026-10-27).
