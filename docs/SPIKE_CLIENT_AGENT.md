# Spike: PayPal Agent Toolkit + a client agent

PayPilot's HITL rule is unchanged: **the model never creates or sends a PayPal invoice**. Confirm in the UI is the only write path.

This spike asked whether a *client* agent can **pay** a sandbox invoice (not whether we can list toolkit tools).

## Paths tried

| Path | Attempted | Success | Detail |
| --- | --- | --- | --- |
| record-payment | yes | yes | 5/5 toolkit record_payment_for_invoice marked the invoice paid (external OTHER). |
| payouts | no | no | Skipped: set PAYPAL_PAYOUT_RECEIVER (sandbox Personal email) to try Payouts. Payouts send money; they do not mark an Invoicing invoice PAID. |
| kernel | no | no | Skipped: KERNEL_API_KEY is not set. Cannot open a Kernel cloud browser as the sandbox Personal buyer. |

### record-payment runs

```
5/5
run 1: INV2-ENFV-DUDB-H2UX-ZSHB MARKED_AS_PAID
run 2: INV2-59Q5-BSJ6-GYMX-U8WB MARKED_AS_PAID
run 3: INV2-L685-CZ96-FDLS-QM8N MARKED_AS_PAID
run 4: INV2-QW7Q-WW9C-5WCD-EEMZ MARKED_AS_PAID
run 5: INV2-D3H4-CWQ8-XJ8W-JZ2U MARKED_AS_PAID
```

## Webhook PAID

This spike polled `GET /v2/invoicing/invoices/{id}` after each record-payment. All five returned `MARKED_AS_PAID`. It did **not** wait for `INVOICING.INVOICE.PAID` to hit Render. Merchant-recorded payments may emit that event; they are still not a Personal buyer checkout.

## Recommendation

Use **record-payment** only as a merchant-side mark-paid. It is not a client paying. Do **not** ship a client-agent that records OTHER payments — that bypasses the buyer. For a real client-agent, a human (or Kernel with buyer credentials) must open the share link. **Drop the client-agent product** unless Kernel + buyer login is funded.

## Toolkit vs REST (confirm path)

See [docs/TOOLKIT_CONFIRM.md](TOOLKIT_CONFIRM.md). Chat still only gets list/search.

## How to rerun

```bash
npm run spike:client-agent
```

Optional env (never commit values): `PAYPAL_PAYOUT_RECEIVER`, `KERNEL_API_KEY`.
