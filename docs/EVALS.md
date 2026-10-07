# PayPilot parser evals

Headline: **40/40** cases passed on `npm run eval`.

These cases score deterministic parsers and policy (`parseChatAmount` + `evaluateProposal`). The chat model still drafts invoices; it cannot create or send PayPal invoices. Arithmetic stays in code.

| id | category | result | detail |
| --- | --- | --- | --- |
| amt-usd-dollar | amount | pass | USD 48000 |
| amt-usd-40k | amount | pass | USD 4000000 |
| amt-inr-rupee | amount | pass | INR 4000000 |
| amt-inr-rs | amount | pass | INR 120000 |
| amt-usd-cents | amount | pass | USD 48050 |
| amt-usd-comma | amount | pass | USD 120000 |
| amt-inr-inr-word | amount | pass | INR 2500000 |
| amt-usd-word | amount | pass | USD 48000 |
| amt-usd-k-decimal | amount | pass | USD 250000 |
| amt-null-empty | amount | pass | null |
| amt-null-negative | amount | pass | null |
| amt-usd-plain | amount | pass | USD 7500 |
| ok-landing-480 | proposal | pass | $48000 |
| ok-qty-2 | proposal | pass | $30000 |
| ok-due-date | proposal | pass | $12000 |
| ok-note | proposal | pass | $9900 |
| ok-multi-items | proposal | pass | $15000 |
| ok-at-cap | cap | pass | $500000 |
| cap-over | cap | pass | over_limit |
| cap-huge | cap | pass | over_limit |
| fx-unconfirmed-false | fx | pass | fx_unconfirmed |
| fx-unconfirmed-missing | fx | pass | fx_unconfirmed |
| fx-ok-labeled | fx | pass | $48000 |
| fx-mismatch | fx | pass | fx_mismatch |
| fx-live-rate | fx | pass | $1037 |
| sanitize-tags | sanitize | pass | $12000 |
| sanitize-jailbreak-name | sanitize | pass | $12000 |
| reject-bad-email | reject | pass | schema rejected email |
| reject-empty-name | reject | pass | invalid_client |
| reject-zero | reject | pass | invalid_amount |
| reject-empty-items | reject | pass | empty_items |
| reject-bad-due | reject | pass | schema rejected dueDate |
| ok-harbor | proposal | pass | $95000 |
| ok-northwind | proposal | pass | $75000 |
| ok-small | proposal | pass | $1 |
| ok-qty-hours | proposal | pass | $100000 |
| amt-inr-first-amount | amount | pass | INR 8000000 |
| amt-usd-net10 | amount | pass | USD 22000 |
| fx-no-rate | fx | pass | fx_unconfirmed |
| ok-description | proposal | pass | $18000 |

All cases passed.
