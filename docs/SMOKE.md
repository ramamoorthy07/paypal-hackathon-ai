# Live E2E smoke

Target: `https://paypilot-docker.onrender.com`

> Historical snapshot from **2026-10-08**. On the current branch, `/unlock` and `/api/mcp` exist (local `next build` lists them). The live 404s below were deploy lag on that date, not missing code.

Recorded against the running Render free Docker service. Chat/confirm were not exercised end-to-end here (would burn a sandbox invoice and needs the demo cookie). No secrets printed.

| Check | Result | Notes |
| --- | --- | --- |
| `GET /api/health/live` | **200** `{"ok":true}` in 0.4s | Cold start was already warm |
| `GET /api/health` | **200** `ok: true` in 2.1s | sandbox, Azure `gpt-5-mini`, webhook configured, PayPal ok |
| `GET /` | **200** | Chat page |
| `GET /dashboard` | **200** | 3.1s |
| `GET /invoices` | **200** | |
| `GET /unlock` | **404** | Live image is **behind** `origin/main` (GitHub has `/unlock` and `/api/mcp`) |
| `POST /api/mcp` | **404** | Same: MCP is on GitHub main, not this Render deploy |
| DB `invoiceCount` | **5** | Old live image; this branch does not seed fake invoices |
| PayPal sample | `MARKED_AS_PAID` | Sandbox merchant is reachable. Status reflects later spike record-payments, not a buyer checkout |

## Gaps to fix on Render (ops, not code)

1. Redeploy `paypilot-docker` from current `main` so `/unlock`, `/api/mcp`, dashboard insights, and the sidebar ship.
2. Point `DATABASE_URL` + `DATABASE_AUTH_TOKEN` at Turso. The app does not seed fake invoices.
3. Set `DEMO_ACCESS_CODE` and `MCP_BEARER_TOKEN` in the Render dashboard.
4. Confirm GitHub Action secrets `APP_URL`, `CRON_URL`, `CRON_SECRET`.

## Local confirmation (this branch)

`npm test` 126 passed. `npm run eval` golden 40/40. `npx next build` succeeded (`/unlock` and `/api/mcp` in the route list).
