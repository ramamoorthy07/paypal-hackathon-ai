# PayPilot

AI freelancer payment agent. Talk in chat, confirm an invoice, send a real PayPal sandbox payment request, and track whether the client paid.

## Run locally

1. Copy env and fill in sandbox credentials from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/):

```bash
cp .env.example .env.local
```

Required for this step: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `OPENAI_API_KEY` (validated at startup even though chat lands later).

2. Install and start:

```bash
npm install
npm run dev
```

3. Confirm PayPal auth:

```bash
curl -sS http://localhost:3000/api/health | python3 -m json.tool
```

You want `"ok": true`, `checks.db.ok: true`, and `checks.paypal.ok: true`.

Seed five local demo invoices (paid, sent, overdue, cancelled, draft). These are **not** created in PayPal:

```bash
npm run db:seed
```

`checks.db.invoiceCount` should be at least 5 after seeding. The SQLite file lives at `data/paypilot.db` and is gitignored.

Use a **Sandbox Business** app for the merchant credentials. A **Sandbox Personal** account is the buyer for later invoice payments.

## What exists now

- Env validation (`lib/env.ts`) — fails fast with missing-variable names, never logs secrets
- `/api/health` — env + SQLite ping + PayPal OAuth + list 1 invoice
- Drizzle schema, repositories, and `npm run db:seed`
- Placeholder home page
