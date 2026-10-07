# Spike: PayPal Agent Toolkit + a client agent

PayPilot's HITL rule is unchanged: **the model never creates or sends a PayPal invoice**. Confirm in the UI is the only write path.

This spike asked what a *client* agent would see if we handed it `@paypal/agent-toolkit` against sandbox.

## Toolkit (v1.11.0)

`PayPalAgentToolkit` from `@paypal/agent-toolkit/ai-sdk` with `configuration.context.sandbox: true`.

Invoice tools the package can expose:

| Tool | Kind |
| --- | --- |
| `list_invoices` | read |
| `search_invoicing` | read |
| `get_invoice` | read |
| `create_invoice` | write |
| `send_invoice` | write |
| `send_invoice_reminder` | write |
| `cancel_sent_invoice` | write |
| `delete_invoice` | write |
| `generate_invoice_qr_code` | write-ish |
| plus recurring-series create/activate/cancel/delete | write |

`get_merchant_insights` throws in sandbox (`not supported in sandbox mode`).

The toolkit's sandbox API host is `https://api.sandbox.paypal.com` (not `api-m`). PayPilot's own invoicing client still uses `api-m.sandbox.paypal.com`.

## What PayPilot enables

```ts
actions: { invoices: { list: true, search: true } }
context: { sandbox: true }
```

`isPaypalReadToolName` also drops anything matching create/send/cancel/delete/update/record/remind/generate/activate.

Chat may attach those read tools. MCP does **not** expose them; MCP only reads the local DB.

## Client-agent risk

If a judge (or a Cursor MCP client) received the **full** toolkit, it could draft and send sandbox invoices without the confirmation card. That breaks HITL.

Safe pattern:

1. PayPilot chat: `proposeInvoice` (local DRAFT) + cash/risk/overdue + optional toolkit list/search.
2. Human Confirm → PayPal share link (`send_to_recipient: false` unless the checkbox).
3. External MCP: overdue / forecast / risk facts only.

## How to rerun

```bash
npm run spike:tools
npx tsx scripts/spike/sandbox-list.ts
```

`spike:tools` uses dummy credentials and only prints tool names. `sandbox-list` needs sandbox keys in `.env.local` and lists at most 5 invoice ids/statuses. It does not print secrets.
