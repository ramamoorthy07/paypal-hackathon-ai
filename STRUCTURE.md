# PayPilot repository structure

Canonical tree for technical review. Regenerate after large moves.

Excluded: `node_modules/`, `.next/`, `.git/`, `data/`, `.env.local`, `package-lock.json`.

```text
paypilot/
├── .github/
│   └── workflows/
│       ├── keepalive.yml
│       └── overdue.yml
├── app/
│   ├── activity/
│   │   └── page.tsx
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts
│   │   ├── cron/
│   │   │   └── overdue/
│   │   │       └── route.ts
│   │   ├── fx/
│   │   │   └── route.ts
│   │   ├── health/
│   │   │   ├── live/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── insights/
│   │   │   └── why/
│   │   │       └── route.ts
│   │   ├── invoices/
│   │   │   ├── [id]/
│   │   │   │   ├── qr/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── remind/
│   │   │   │   │   └── route.ts
│   │   │   │   └── sync/
│   │   │   │       └── route.ts
│   │   │   ├── confirm/
│   │   │   │   └── route.ts
│   │   │   └── reconcile/
│   │   │       └── route.ts
│   │   ├── mcp/
│   │   │   └── route.ts
│   │   ├── summary/
│   │   │   └── monthly/
│   │   │       └── route.ts
│   │   ├── unlock/
│   │   │   └── route.ts
│   │   └── webhooks/
│   │       ├── paypal/
│   │       │   └── route.ts
│   │       └── simulate/
│   │           └── route.ts
│   ├── dashboard/
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── invoices/
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── unlock/
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── loading.tsx
│   └── page.tsx
├── components/
│   ├── activity/
│   │   ├── activity-table.tsx
│   │   └── webhook-simulator.tsx
│   ├── chat/
│   │   ├── chat-app.tsx
│   │   └── confirmation-card.tsx
│   ├── dashboard/
│   │   ├── cash-forecast-chart.tsx
│   │   ├── client-risk-grid.tsx
│   │   ├── earnings-grid.tsx
│   │   └── monthly-summary.tsx
│   ├── invoices/
│   │   ├── invoice-open-refresh.tsx
│   │   ├── invoice-qr.tsx
│   │   ├── invoice-remind.tsx
│   │   ├── invoice-status-sync.tsx
│   │   ├── invoices-table.tsx
│   │   └── paypal-reconcile-button.tsx
│   ├── layout/
│   │   └── app-shell.tsx
│   └── ui/
│       ├── kpi-card.tsx
│       ├── route-loading.tsx
│       ├── status-badge.tsx
│       └── theme-toggle.tsx
├── docs/
│   ├── screenshots/
│   │   ├── 01-chat.png
│   │   ├── 02-confirm-card.png
│   │   ├── 03-dashboard.png
│   │   ├── 04-invoices.png
│   │   ├── 05-unlock.png
│   │   └── README.md
│   ├── spikes/
│   │   ├── CLIENT_AGENT.md
│   │   └── README.md
│   ├── EVALS.md
│   ├── MCP.md
│   ├── SMOKE.md
│   └── TOOLKIT_CONFIRM.md
├── drizzle/
│   ├── meta/
│   │   ├── 0000_snapshot.json
│   │   ├── 0001_snapshot.json
│   │   └── _journal.json
│   ├── 0000_init.sql
│   ├── 0001_is_demo.sql
│   ├── 0002_reminder_tone.sql
│   └── 0003_rate_limits.sql
├── hooks/
│   └── use-theme.ts
├── lib/
│   ├── access/
│   │   ├── abuse.ts
│   │   ├── demo-code.ts
│   │   └── mcp-bearer.ts
│   ├── agent/
│   │   ├── evals.ts
│   │   ├── insight-tools.ts
│   │   ├── messages.ts
│   │   ├── prompt.ts
│   │   ├── propose-save.ts
│   │   ├── propose.ts
│   │   ├── schema.ts
│   │   ├── stream-error.ts
│   │   └── tools.ts
│   ├── core/
│   │   ├── env.ts
│   │   ├── money.ts
│   │   └── sanitize.ts
│   ├── cron/
│   │   ├── auth.ts
│   │   └── http.ts
│   ├── db/
│   │   ├── repositories/
│   │   │   ├── audit-log.ts
│   │   │   ├── clients.ts
│   │   │   ├── invoices.ts
│   │   │   ├── rate-limits.ts
│   │   │   ├── reminders.ts
│   │   │   └── webhook-events.ts
│   │   ├── index.ts
│   │   ├── redact.ts
│   │   └── schema.ts
│   ├── fx/
│   │   └── quote.ts
│   ├── health/
│   │   └── public.ts
│   ├── insights/
│   │   ├── behavior.ts
│   │   ├── forecast.ts
│   │   ├── queries.ts
│   │   └── why.ts
│   ├── invoices/
│   │   ├── actions/
│   │   │   ├── confirm.ts
│   │   │   ├── reconcile.ts
│   │   │   ├── remind.ts
│   │   │   ├── reminder-copy.ts
│   │   │   └── sync.ts
│   │   ├── earnings.ts
│   │   ├── state.ts
│   │   ├── summary.ts
│   │   ├── views.ts
│   │   └── webhook-handlers.ts
│   ├── llm/
│   │   ├── azure.ts
│   │   ├── ping.ts
│   │   ├── plain-text.ts
│   │   └── provider.ts
│   ├── mcp/
│   │   └── handler.ts
│   └── paypal/
│       ├── client.ts
│       ├── errors.ts
│       ├── invoicing.ts
│       ├── read-tools.ts
│       ├── schemas.ts
│       ├── toolkit-write.ts
│       └── webhooks.ts
├── postman/
│   ├── PayPilot.postman_collection.json
│   └── PayPilot.postman_environment.json
├── scripts/
│   ├── spike/
│   │   ├── client-agent.ts
│   │   └── list-toolkit-tools.ts
│   ├── eval.ts
│   └── register-paypal-webhook.ts
├── tests/
│   ├── access/
│   │   ├── cron-auth.test.ts
│   │   └── mcp-bearer.test.ts
│   ├── agent/
│   │   ├── evals.test.ts
│   │   ├── invoice-proposal.test.ts
│   │   ├── mcp-propose.test.ts
│   │   ├── prompt-injection.test.ts
│   │   └── toolkit-confirm.test.ts
│   ├── core/
│   │   ├── db-persistence.test.ts
│   │   ├── money.test.ts
│   │   └── sanitize.test.ts
│   ├── fx/
│   │   └── fx.test.ts
│   ├── insights/
│   │   └── insights.test.ts
│   ├── invoices/
│   │   ├── confirm-invoice.test.ts
│   │   ├── earnings.test.ts
│   │   ├── invoice-state.test.ts
│   │   ├── invoice-sync.test.ts
│   │   ├── reminder-copy.test.ts
│   │   └── reminders.test.ts
│   ├── llm/
│   │   └── llm-azure.test.ts
│   ├── paypal/
│   │   ├── paypal-errors.test.ts
│   │   ├── paypal-invoicing.test.ts
│   │   ├── paypal-read-tools.test.ts
│   │   ├── paypal-reconcile.test.ts
│   │   └── paypal-webhooks.test.ts
│   └── security/
│       ├── access-gate.test.ts
│       ├── route-gate-enumeration.test.ts
│       └── webhook-simulator-gate.test.ts
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── AGENTS.md
├── DEMO.md
├── Dockerfile
├── drizzle.config.ts
├── eslint.config.mjs
├── instrumentation.ts
├── LICENSE
├── middleware.ts
├── next-env.d.ts
├── next.config.ts
├── package.json
├── README.md
├── render.yaml
├── STRUCTURE.md
├── tsconfig.json
└── vitest.config.ts
```

## Top-level roles

| Path | Role |
| --- | --- |
| `app/` | Next.js pages + API routes |
| `components/` | UI by feature (`ui`, `layout`, `chat`, `invoices`, `dashboard`, `activity`) |
| `hooks/` | Client React hooks |
| `lib/core/` | Shared primitives (`env`, `money`, `sanitize`) |
| `lib/access/` | Demo gate, abuse / rate limits, MCP bearer |
| `lib/cron/` | Overdue cron auth + HTTP handler |
| `lib/agent/` | Chat propose, insight tools, prompts, evals |
| `lib/paypal/` | PayPal REST, toolkit, webhook verify |
| `lib/invoices/` | State machine, views, read models; writes in `actions/` |
| `lib/insights/` | Forecast, risk, Why? |
| `lib/db/` | Drizzle schema + repositories |
| `tests/` | Mirrors domains (`agent`, `paypal`, `invoices`, `security`, …) |
| `docs/` | Runbooks + `spikes/` evidence |
| `scripts/` | Eval + spike runners |

