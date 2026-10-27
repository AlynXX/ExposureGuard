# ExposureGuard AI

ExposureGuard AI is a privacy-first web demo that turns scattered exposure
signals into a clear, actionable report. It combines a safe breach scenario,
personal-data detection, local file analysis and transparent risk scoring.

The current demo deliberately does **not** query real addresses. It accepts only
`demo@exposureguard.test`, returns fictional breach records and lets the product
flow be tested without exposing anyone's data.

## What works

- email ownership flow with a visible demo code (`624811`);
- fictional breach timeline with exposed data categories;
- detection of email, phone, PESEL, IBAN, payment card, IP, birth date and
  username;
- contextual detection of names, locations and employers in Polish and English;
- local TXT/MD/PDF text extraction;
- local image OCR and EXIF checks for GPS, device and capture time;
- explainable 0–100 exposure index with every positive and negative contribution;
- likely attack paths described in plain language;
- editable findings, security-control toggles, bilingual PL/EN interface;
- printable report that can be saved as PDF.

## Privacy and safety

- Text pasted into the demo stays in browser state.
- Files are processed in the browser and are not uploaded by application code.
- Raw breach rows and passwords are never displayed or collected.
- The breach fixtures use reserved `.example` domains and are clearly labelled
  as fictional.
- A missing breach result must never be presented as proof of safety.

Before a public live lookup is enabled, the production version should add
server-side rate limiting, abuse monitoring, short-lived verification codes,
strict logging redaction and an auditable provider adapter. XposedOrNot is the
planned free-default adapter; HIBP remains optional for users who supply their
own key.

## Local development

Requirements: Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

Then open the local address shown in the terminal.

## Verification

```powershell
npm run lint
npm test
```

`npm test` creates the production build and checks the server-rendered product
shell, privacy copy and social metadata.

## Architecture

```text
UI
├── safe breach demo
├── text and file scanner
└── report
    ├── deterministic findings
    ├── transparent risk contributions
    └── plain-language attack paths and actions

Browser-only file pipeline
├── PDF.js  → text layer
├── Tesseract.js → image OCR
└── exifr → EXIF metadata
```

The scoring engine is deterministic and inspectable. AI can later help simplify
or personalise explanations, but it must not invent evidence or decide whether
someone is safe.

## Roadmap

### Implemented provider foundation

`app/lib/breachProvider.mjs` implements the free XposedOrNot email-check
contract documented at https://xposedornot.com/api_doc (checked 2026-10-27).
It accepts a trusted, unexpired backend identity, encodes the address, disables
caching, enforces a timeout and distinguishes missing results from provider
failures. Results contain breach names only; this endpoint does not justify
inventing dates, data categories or scoring evidence.

Run `npm run test:unit` for six offline contract and failure-path tests. These
tests do not submit any address to an external service.

The adapter is intentionally not exposed as an HTTP endpoint yet. Before wiring
it to the UI, implement server-issued verification bound to the email, expiring
sessions, request throttling and a production mail transport. The public demo
code must never create the trusted identity accepted by this adapter. A result
of `not_found` means only that this provider returned no known record.

1. Configure the implemented verified-email backend and XposedOrNot adapter;
   see [email verification](docs/email-verification.md).
2. Add encrypted, opt-in scan history with automatic deletion.
3. Expand entity detection with a small multilingual NER model and keep the
   regex/validator layer as evidence.
4. Add regression fixtures for PDFs and EXIF-bearing images.
5. Package the validated web flow as a signed Windows desktop application.

## Responsible use

This is a defensive tool for checking data you own or are authorised to assess.
It must not be extended into a people-search or bulk-enumeration service.

Generated social card: built-in ImageGen, with the final project asset stored at
`public/exposureguard-social.png`.
