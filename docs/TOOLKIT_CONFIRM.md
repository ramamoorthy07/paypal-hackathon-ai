# Post-Confirm PayPal Agent Toolkit

PayPilot still **does not** give the chat model `create_invoice` or `send_invoice`. Confirm in the UI is the only write trigger.

After Confirm, PayPilot prefers `@paypal/agent-toolkit` for create + send, then falls back to Invoicing REST.

## Fields the toolkit can set

| Field | Toolkit |
| --- | --- |
| Line items (name, description, quantity, unit_amount) | `create_invoice.items` |
| Note | `create_invoice.note` |
| Recipient name + email | `create_invoice.primary_recipients` |
| Currency | `create_invoice.currency_code` |
| `send_to_recipient` | `send_invoice.send_to_recipient` (PayPilot passes `false` unless the email checkbox) |

## Gaps (toolkit cannot set these)

| Field | PayPilot REST | What we do |
| --- | --- | --- |
| `detail.payment_term.due_date` | yes | REST **create** when the local draft has a due date |
| `detail.payment_term.term_type` (`NET_10`) | yes | same |
| `PayPal-Request-Id` idempotency | yes | REST fallback on toolkit errors |

`send_to_invoicer` is not on the toolkit send schema. PayPilot’s REST send always sets it `false`. Toolkit send omits it.

## Model trigger test

`agentTools` and `paypalReadOnlyAgentTools()` must not include `create_invoice` / `send_invoice`. Covered in `tests/paypal-read-tools.test.ts` and `tests/prompt-injection.test.ts`.
