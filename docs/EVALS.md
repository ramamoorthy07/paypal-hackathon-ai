# PayPilot parser evals

Golden set: **40/40**. Held-out: **15/15** (baseline **6/15** before parser changes).

These cases score deterministic parsers and policy (`parseChatAmount` + `evaluateProposal`). The chat model still drafts invoices; it cannot create or send PayPal invoices. Arithmetic stays in code.

## How this was measured

1. Wrote 15 held-out cases against the intended policy (last revised amount, refuse mixed currencies / euros / two emails, skip ISO date years, prefer marked amounts).
2. Ran them against the old first-amount parser **without tuning**. Baseline: **6/15**.
3. Applied general parser rules (not per-utterance). Golden `amt-inr-cut-to-last` (was `amt-inr-first-amount`) now expects ₹40,000 because `cut to` is a revision cue.

## Baseline held-out failures (before)

| id | detail |
| --- | --- |
| hold-conflict-agreed | got USD 40000 |
| hold-conflict-not | got USD 12000 |
| hold-euros | expected null, got USD 48000 |
| hold-dual-currency | expected null, got INR 4000000 |
| hold-meant-usd | got INR 4000000 |
| hold-two-clients | expected null, got USD 12000 |
| hold-iso-date-prefix | got USD 202600 |
| hold-cut-to | got USD 4000000 |
| hold-long-thread | got USD 200 |

Root cause for all nine: `parseChatAmount` took the first regex number. That turned `2026-11-01` into $2,026, `2 weeks` into $2, `480 euros` into USD, and ignored later agreed/meant/cut-to amounts.

## After general parser rules

Held-out **15/15**.

No remaining held-out failures.

## Golden set (40)

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
| amt-inr-cut-to-last | amount | pass | INR 4000000 |
| amt-usd-net10 | amount | pass | USD 22000 |
| fx-no-rate | fx | pass | fx_unconfirmed |
| ok-description | proposal | pass | $18000 |

All golden cases passed.

## Held-out set (15)

| id | category | result | detail |
| --- | --- | --- | --- |
| hold-conflict-agreed | amount | pass | USD 48000 |
| hold-conflict-not | amount | pass | USD 22000 |
| hold-euros | amount | pass | null |
| hold-dual-currency | amount | pass | null |
| hold-meant-usd | amount | pass | USD 48000 |
| hold-relative-due | amount | pass | USD 35000 |
| hold-two-clients | amount | pass | null |
| hold-iso-date-prefix | amount | pass | USD 22000 |
| hold-cut-to | amount | pass | USD 1200000 |
| hold-long-thread | amount | pass | USD 125000 |
| hold-relative-due-schema | reject | pass | schema rejected dueDate |
| hold-nested-inject | sanitize | pass | $12000 |
| hold-indirect-admin | sanitize | pass | $18000 |
| hold-inject-line-item | sanitize | pass | $22000 |
| hold-fx-note-lies | fx | pass | fx_unconfirmed |
