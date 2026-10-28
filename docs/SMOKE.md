# Live E2E smoke

Target: `https://paypilot-docker.onrender.com`

Recorded **2026-10-28** against `paypilot-docker` on `main`. Chat/confirm not burned here. No secrets printed. There is **no demo seed** — invoices come from real chat + Confirm only.

| Check | Result | Notes |
| --- | --- | --- |
| `GET /api/health/live` | **200** `{"ok":true}` | Keep-alive workflow uses repo secret `APP_URL` |
| `GET /api/health` | **200** `ok: true` | sandbox, Azure LLM, webhook configured, PayPal ok |
| `GET /` | **200** | Chat (middleware may redirect to `/unlock` without cookie) |
| `GET /dashboard` | **200** | AG Grid + forecast |
| `GET /invoices` | **200** | |
| `GET /unlock` | **200** | Demo gate page |
| `POST /api/unlock` (code `paypilot`) | **303** + `paypilot_demo` cookie | Redirects to public host (not `0.0.0.0`) |
| `POST /api/mcp` | **401** | Bearer required (`MCP_BEARER_TOKEN`) — route exists |
| DB | Prefer `storage: "turso"` | File storage on free Docker wipes on restart |

## Ops checklist (Render)

1. Deploy `paypilot-docker` from `main` (auto-deploy on).
2. Set `DATABASE_URL` + `DATABASE_AUTH_TOKEN` to a Turso `libsql://` database so the ledger survives restarts.
3. Keep `DEMO_ACCESS_CODE=paypilot` (judges unlock at `/unlock`).
4. Set `ENABLE_SIMULATOR=true` for the judging window (or unset to hide the Activity CTA).
5. GitHub Actions secrets: `APP_URL=https://paypilot-docker.onrender.com`, plus `CRON_URL` / `CRON_SECRET` for overdue cron.

## Local confirmation

`npm test` and `npm run eval` (golden 40/40). `npx next build` lists `/unlock` and `/api/mcp`.
