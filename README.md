# PayPilot

AI freelancer payment agent. Talk in chat, confirm an invoice, send a real PayPal sandbox payment request, and track whether the client paid.

## Run locally

1. Copy env and fill in sandbox credentials from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/):

```bash
cp .env.example .env.local
```

PayPal keys are required for a green PayPal health check. Chat uses Azure OpenAI (`AZURE_OPENAI_ENDPOINT` + `OPENAI_API_KEY` as the Azure api-key). The database and seed work without them. Get sandbox credentials from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).

2. Install, seed, and start (use **two terminals** — `npm run dev` is a long-running process):

```bash
npm install
npm run db:seed
npm run dev
```

3. In another terminal, confirm health:

```bash
curl -sS http://localhost:3000/api/health | python3 -m json.tool
```

Without PayPal/OpenAI keys the server still starts. Health will be HTTP 503 with `checks.env.ok: false` and `checks.db.ok: true` (`invoiceCount` at least 5 after seed). After you fill `.env.local`, restart `npm run dev` and expect `"ok": true` plus `checks.paypal.ok: true`.

Seed five local demo invoices (paid, sent, overdue, cancelled, draft). These are **not** created in PayPal:

```bash
npm run db:seed
```

`checks.db.invoiceCount` should be at least 5 after seeding. The SQLite file lives at `data/paypilot.db` and is gitignored.

Unit tests (PayPal HTTP is mocked; they do not create sandbox invoices):

```bash
npm test
```

Use a **Sandbox Business** app for the merchant credentials. A **Sandbox Personal** account is the buyer for later invoice payments.

## What exists now

- Env validation (`lib/env.ts`) — fails fast with missing-variable names, never logs secrets
- `/api/health` — env + SQLite ping + PayPal OAuth + Azure OpenAI models ping
- Drizzle schema, repositories, and `npm run db:seed`
- `/api/chat` — streaming agent with `proposeInvoice` (local `DRAFT` only; no PayPal send)
- `/` — chat UI and confirmation card
- `POST /api/invoices/confirm` — first PayPal contact: create draft + send as share link, then local `SENT`
- `/dashboard` — AG Grid earnings table, overdue/outstanding filters, KPI cards, AI monthly summary
- `/invoices` and `/invoices/[id]` — local list, derived OVERDUE, payer link, QR
- `POST /api/webhooks/paypal` — verify-webhook-signature, then PAID/CANCELLED (idempotent)
- `POST /api/invoices/[id]/sync` — fallback GET of the PayPal invoice when webhooks cannot reach localhost
- `POST /api/summary/monthly` — AI briefing from local invoice totals (no PayPal call)
