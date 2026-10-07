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
- **Render** — `render.yaml` Blueprint (web service + reminder cron + SQLite disk)
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

Blueprint: [`render.yaml`](render.yaml).

1. New → Blueprint, connect [this GitHub repo](https://github.com/ramamoorthy07/paypal-hackathon-ai).
2. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `DATABASE_URL`, and `DATABASE_AUTH_TOKEN` (Turso). Optional: `PAYPAL_WEBHOOK_ID`.
3. After the first deploy, subscribe a PayPal sandbox webhook to `https://<service>.onrender.com/api/webhooks/paypal` for `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`. Until then, invoice pages poll.
4. `SEED_ON_BOOT=true` loads demo rows only when the database is empty (`is_demo = true`).

Liveness for Render is `GET /api/health/live` (no PayPal/LLM). Full checks stay on `/api/health`.

## Scheduled reminders (GitHub Actions)

Render free has no cron. [`.github/workflows/overdue.yml`](.github/workflows/overdue.yml) `POST`s `/api/cron/overdue` at 09:00 and 21:00 UTC (`workflow_dispatch` works too).

Repo secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CRON_URL` | `https://<service>.onrender.com/api/cron/overdue` |
| `CRON_SECRET` | same bearer token as the Render `CRON_SECRET` env var |

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

## License

MIT. See [LICENSE](LICENSE).
