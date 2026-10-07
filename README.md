# PayPilot

AI freelancer payment agent for the PayPal AI Hackathon. Talk in chat, confirm an invoice, send a real PayPal sandbox payment request, track whether the client paid, and remind them when they are overdue.

**PayPal is the payment rail** (Invoicing REST, share-link send, webhooks, QR, remind). **AI is the operator** (parse messy chat, draft a local invoice, write a monthly briefing, compose reminder copy). The model never creates or sends a PayPal invoice.

```text
chat → proposeInvoice (local DRAFT) → Confirm → PayPal share link
     → webhook or poll PAID → /invoices + AG Grid /dashboard
     → overdue AI note → PayPal remind (max 2/UTC day)
```

## Sponsors used

- **AG Grid Community** — `/dashboard` earnings table, overdue/outstanding filters, row open
- **Render** — free Docker web service (`paypilot-docker`)
- **Postman** — `postman/PayPilot.postman_collection.json`

## Run locally

1. Copy env and fill sandbox credentials from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/):

```bash
cp .env.example .env.local
```

PayPal keys are required for a green PayPal health check. Chat uses Azure OpenAI (`AZURE_OPENAI_ENDPOINT` + `OPENAI_API_KEY` as the Azure api-key). The database and seed work without them.

2. Install, seed, and start (use **two terminals** — `npm run dev` is a long-running process):

```bash
npm install
npm run db:seed
npm run dev
```

3. Confirm health:

```bash
curl -sS http://localhost:3000/api/health | python3 -m json.tool
```

Without PayPal/OpenAI keys the server still starts. Health will be HTTP 503 with `checks.env.ok: false` and `checks.db.ok: true` (`invoiceCount` at least 5 after seed). After you fill `.env.local`, restart `npm run dev` and expect `"ok": true`.

Seed five **demo** invoices (paid, sent, overdue, cancelled, draft) only when the database is empty. They are flagged `is_demo = true` and are not created in PayPal. Local default is libSQL file `data/paypilot.db` (gitignored). Production should use Turso (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`) so data survives Render restarts.

```bash
npm test
```

Unit tests mock PayPal HTTP. They do not create sandbox invoices.

Use a **Sandbox Business** app for merchant credentials. A **Sandbox Personal** account is the buyer.

## Deploy on Render

Live service: **paypilot-docker** at `https://paypilot-docker.onrender.com`. It is a **free Docker** web service. There is **no disk**, **no Starter plan**, and **no Render cron**. SQLite on the instance is wiped on restart; use Turso (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`).

[`render.yaml`](render.yaml) matches that. Secrets are listed with `sync: false` (set them in the Render dashboard; do not put values in git).

Required env (no values in git):

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`
- `OPENAI_API_KEY` (Azure api-key), `AZURE_OPENAI_ENDPOINT`, optional `AZURE_OPENAI_DEPLOYMENT`
- `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (Turso)
- `PAYPAL_WEBHOOK_ID` (after you subscribe the webhook)
- `CRON_SECRET` (same value as the GitHub Actions secret)
- `DEMO_ACCESS_CODE` (required in production for chat, confirm, and remind)

Optional: `SEED_ON_BOOT=true` (demo rows only when the database is empty, `is_demo = true`).

After deploy, subscribe a PayPal sandbox webhook to `https://paypilot-docker.onrender.com/api/webhooks/paypal` for `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`. Until then, invoice pages poll.

Liveness is `GET /api/health/live` (no PayPal/LLM). Full checks stay on `/api/health`.

**Cold start:** the free instance sleeps after idle time. The first request can take a minute. [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) `GET`s `/api/health/live` every 10 minutes. Set repo secret `APP_URL` to `https://paypilot-docker.onrender.com`. This uses GitHub Actions minutes; it is not a Render Background Worker.

## Scheduled reminders (GitHub Actions)

Render free has no cron. [`.github/workflows/overdue.yml`](.github/workflows/overdue.yml) `POST`s `/api/cron/overdue` at 09:00 and 21:00 UTC (`workflow_dispatch` works too).

Repo secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CRON_URL` | `https://paypilot-docker.onrender.com/api/cron/overdue` |
| `CRON_SECRET` | same bearer token as the Render `CRON_SECRET` env var |
| `APP_URL` | `https://paypilot-docker.onrender.com` (keep-alive ping) |

The route is not demo-gated. In production it returns 401 unless `Authorization: Bearer $CRON_SECRET` matches. `/api/cron/reminders` is an alias.

## Postman

1. Import `postman/PayPilot.postman_collection.json` and `postman/PayPilot.postman_environment.json`.
2. Set `baseUrl` to local or the Render URL.
3. Confirm uses `draftInvoiceId` (default `seed-inv-draft`). Replace it with a chat-created draft before a real PayPal send.

## 3-minute video

Shooting script: [DEMO.md](DEMO.md).

## What exists

- Env validation (`lib/env.ts`) — fails fast with missing-variable names, never logs secrets
- `/api/health` and `/api/health/live`
- Drizzle schema, repositories, `npm run db:seed`
- `/api/chat` — streaming agent with `proposeInvoice` (local `DRAFT` only)
- `/` — chat UI and confirmation card
- `POST /api/invoices/confirm` — PayPal draft + share-link send, then local `SENT`
- `/dashboard` — AG Grid earnings, overdue filter, AI monthly summary
- `/invoices` and `/invoices/[id]` — derived OVERDUE, payer link, QR, reminders
- `POST /api/webhooks/paypal` — verify-webhook-signature, then PAID/CANCELLED (idempotent)
- `POST /api/invoices/[id]/sync` — fallback GET when webhooks cannot reach localhost
- `POST /api/summary/monthly` — AI briefing from local totals (no PayPal call)
- `POST /api/invoices/[id]/remind` — AI note + PayPal remind (overdue, max 2/UTC day)
- `GET|POST /api/cron/overdue` — overdue PayPal remind sweep (alias `/api/cron/reminders`); `CRON_SECRET` in production; GitHub Actions twice daily UTC

## Security

- **HITL:** the model can only `proposeInvoice` (local `DRAFT`). PayPal create/send happens only after the user confirms in the UI.
- **Caps:** `MAX_INVOICE_USD` (default 5000), 2 PayPal reminders per invoice per UTC day, per-IP rate limit, daily LLM and PayPal write budgets.
- **Sanitization:** untrusted names, notes, and emails are stripped of HTML, schemes, and control characters before storage.
- **Access gate:** production chat, confirm, and remind require a `DEMO_ACCESS_CODE` cookie from `/unlock`. Health and the PayPal webhook are public.
- **Webhooks:** `/api/webhooks/paypal` verifies `verify-webhook-signature` against `PAYPAL_WEBHOOK_ID`. Invalid signatures are rejected. Event ids are idempotent.
- **Idempotency:** PayPal writes send `PayPal-Request-Id` derived from the local invoice id. Illegal or stale status moves are ignored.
- **Secrets:** `.env*` is gitignored except `.env.example` (empty values). gitleaks over this branch history: no leaks found. Do not commit real keys.

Prompt-injection cases (jailbreak names/notes, extra `paypalSent` fields, missing email) are covered in `tests/prompt-injection.test.ts` and must fail safely.

## License

MIT. See [LICENSE](LICENSE).
