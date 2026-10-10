# PayPilot: Comprehensive Senior Security, Payments & AI Audit

**Date:** October 10, 2026  
**Auditor Role:** Senior Security Engineer, Payments Engineer & AI-Systems Reviewer  
**Scope:** PayPilot Codebase (`ramamoorthy07/paypal-hackathon-ai`)  
**Hackathon Target:** PayPal AI Hackathon (Nov 12, 2026)  
**Methodology:** Read-only inspection of source code, test suites, build outputs, environment schemas, and git history.

---

## A. Money and Correctness

### 1. Integer Cents Consistency
* **Answer:** All monetary values in storage, schemas, and internal logic are represented as integer cents or paise. Floating-point arithmetic occurs during conversion (`cents / 100`) for formatting strings, and in `parseChatAmount` where major unit floats are rounded to minor units via `Math.round(majorUnits * 100)`.
* **Evidence:** `lib/money.ts:18` (`(cents / 100).toFixed(2)`), `lib/money.ts:139` (`minorUnits: Math.round(majorUnits * 100)`), `lib/paypal/invoicing.ts:69` (`centsToAmountString(item.unitAmountCents)`).
* **Severity:** LOW
* **Suggested Fix:** Replace `Math.round(majorUnits * 100)` in `lib/money.ts` with string-split integer parsing (as done in `paypalMajorToCents`) to avoid IEEE 754 precision quirks on inputs like `$1.14`.

### 2. INR ➔ USD Rounding & Currencies
* **Answer:** INR conversion is calculated on the aggregate INR paise total, rounded to USD cents via `Math.round(inrPaise * usdPerInr)`. Line items must match this total within a ±1 cent tolerance, so minor rounding differentials are permitted. Zero-decimal currencies (JPY, KRW) are unsupported; the system strictly enforces `currency: "USD"` across all models and PayPal calls.
* **Evidence:** `lib/money.ts:194` (`Math.round(inrPaise * usdPerInr)`), `lib/agent/propose.ts:103` (`Math.abs(expectedUsdCents - amountCents) > 1`), `lib/paypal/invoicing.ts:61` (`const currency = input.currency ?? "USD"`).
* **Severity:** OK
* **Suggested Fix:** Explicitly reject non-USD/non-INR currency inputs at the prompt schema level, and document that zero-decimal currencies are out of scope.

### 3. MAX_INVOICE_USD Enforcement
* **Answer:** The $5,000 cap cannot be bypassed through negative amounts, zero amounts, high multipliers, or line item splitting because the schema enforces positive integer quantities and non-negative unit amounts, and `evaluateProposal` re-computes `sum(quantity * unitAmountCents)` before checking `amountCents > maxCents`. Furthermore, `/api/invoices/confirm` checks `invoice.amountCents > maxCents` server-side against environment variables prior to dispatching to PayPal.
* **Evidence:** `lib/agent/schema.ts:6-10` (`quantity: z.number().int().positive().max(999)`, `unitAmountCents: z.number().int().nonnegative()`), `lib/agent/propose.ts:79-93`, `lib/invoices/confirm.ts:163-169`.
* **Severity:** OK
* **Suggested Fix:** None required; server-side bounds checking is robust.

### 4. Server-Side Validation on Confirm
* **Answer:** `/api/invoices/confirm` accepts only `{ invoiceId, emailRecipient }` from the client; it does not trust client-supplied amounts, recipient emails, or line items. However, because multi-tenant user authentication is absent, any caller who possesses or enumerates a valid UUID `invoiceId` can trigger the confirmation of that draft.
* **Evidence:** `app/api/invoices/confirm/route.ts:11-14` (`confirmBodySchema = z.object({ invoiceId: z.string().trim().min(1).max(80) })`), `lib/invoices/confirm.ts:135-144`.
* **Severity:** MEDIUM
* **Suggested Fix:** Introduce user/session ownership checks on invoices prior to executing `confirmInvoice`.

### 5. FX Rate Guarantee & API Outages
* **Answer:** The rate displayed on the confirmation card is preserved because `fxRateUsed` and the converted `amountCents` are persisted into the local SQLite database at proposal time and reused at confirm time. If the Frankfurter API returns HTTP errors, 0, NaN, or invalid payloads, Zod validation fails and the system falls back to `env.INR_USD_RATE` (0.012).
* **Evidence:** `lib/fx/quote.ts:20` (`rate: z.number().positive()`), `lib/fx/quote.ts:58-60`, `lib/agent/propose-save.ts:59-65`.
* **Severity:** OK
* **Suggested Fix:** None required; fallback and schema bounds handle external API failure cleanly.

### 6. Due Date Math & Overdue Boundary
* **Answer:** Due dates are parsed as UTC midnight (`YYYY-MM-DDT00:00:00.000Z`). An off-by-one boundary flaw exists in `displayStatus`: `dueDate < now` evaluates to `true` starting at 00:00:01 UTC on the due date itself, prematurely marking an invoice as `OVERDUE` during its active due date rather than after the day concludes.
* **Evidence:** `lib/invoices/state.ts:112` (`if (invoice.status === "SENT" && invoice.dueDate != null && invoice.dueDate < now) return "OVERDUE";`), `lib/agent/propose.ts:113` (`Date.parse(`${raw.dueDate}T00:00:00.000Z`)`).
* **Severity:** MEDIUM
* **Suggested Fix:** Update the condition to `invoice.dueDate + 86_400_000 <= now` so an invoice is only overdue after the full due date has elapsed.

### 7. Taxes, Discounts, and Partial Payments
* **Answer:** Neither taxes, discounts, nor partial payments are supported in the codebase or PayPal payload builders. The line item schema only accepts `name`, `description`, `quantity`, and `unitAmountCents`.
* **Evidence:** `lib/agent/schema.ts:3-12`, `lib/paypal/invoicing.ts:63-71`.
* **Severity:** OK (Code is consistent, but any marketing claim alleging tax support is false)
* **Suggested Fix:** Ensure all marketing, documentation, and pitch materials omit references to tax, discount, or partial payment handling.

---

## B. Idempotency and State

### 8. Double Confirmation & Duplicate Prevention
* **Answer:** If Confirm is submitted concurrently across multiple requests, duplicate PayPal invoice creation is prevented because PayPal deduplicates using the `PayPal-Request-Id` header (`paypilot:${localInvoiceId}:create`), which is deterministically derived from the local invoice ID. Subsequent calls to `confirmInvoice` check `invoice.status === "SENT"` and return the existing URL idempotently.
* **Evidence:** `lib/paypal/errors.ts:87-89` (`idempotencyKey(localInvoiceId, "create")`), `lib/paypal/client.ts:106` (`headers.set("PayPal-Request-Id", idempotencyKey)`), `lib/invoices/confirm.ts:145-147`.
* **Severity:** OK
* **Suggested Fix:** Wrap local draft status reads and updates in a database transaction to prevent concurrent race conditions on local writes.

### 9. Partial Failure & Orphan Draft Recovery
* **Answer:** If PayPal draft creation succeeds but sending fails, the returned `paypalInvoiceId` is stored in the database while leaving the status as `DRAFT`; a subsequent user retry skips draft creation and resumes at the send step. If the server crashes after PayPal send succeeds, the background reconciliation engine (`reconcileInvoicesFromPaypal`) queries PayPal's invoice list, detects the un-synced local invoice by PayPal ID, and applies the snapshot to transition it to `SENT`.
* **Evidence:** `lib/invoices/confirm.ts:175-195`, `lib/invoices/reconcile.ts:107-125`.
* **Severity:** OK
* **Suggested Fix:** Add a specific test verifying resume-on-retry when `sendInvoiceAsShareLink` throws.

### 10. State Machine Integrity & Status Mapping
* **Answer:** Status changes pass through `applyWebhookStatus` or `transition`, preventing illegal transitions (e.g., `PAID` cannot revert to `SENT` or `DRAFT`). However, PayPal statuses `REFUNDED`, `PARTIALLY_REFUNDED`, `PAYMENT_DENIED`, and `REVERSED` are unmapped in `mapPaypalInvoiceStatus` and are silently treated as no-ops (`undefined`).
* **Evidence:** `lib/invoices/state.ts:11-16` (`ALLOWED` map), `lib/invoices/state.ts:66-77` (`applyWebhookStatus`), `lib/invoices/state.ts:90-109` (`mapPaypalInvoiceStatus`).
* **Severity:** LOW
* **Suggested Fix:** Add `REFUNDED` to `InvoiceStatus` schema and update `mapPaypalInvoiceStatus` to transition paid invoices to refunded upon receiving refund webhooks.

### 11. Webhook Verification & Deduplication Flaw
* **Answer:** Webhook verification fails closed with a 503 error if `PAYPAL_WEBHOOK_ID` is unset, and signature verification transmits headers and event payload to PayPal's verification API. However, a significant flaw exists: `recordWebhookEvent` inserts the event ID into the database *before* calling `syncInvoiceByPaypalId`; if invoice synchronization fails due to a downstream database error, the event remains marked as processed, and PayPal's subsequent retries are permanently discarded as duplicates.
* **Evidence:** `app/api/webhooks/paypal/route.ts:20-25`, `lib/invoices/webhooks.ts:24-27`, `lib/db/repositories/webhook-events.ts:19-24`.
* **Severity:** HIGH
* **Suggested Fix:** Execute `recordWebhookEvent` and the invoice state transition within the same atomic database transaction, or delete the deduplication record if invoice synchronization throws.

### 12. Webhook Race on Pre-Storage Events
* **Answer:** Under ordinary flows, an invoice cannot be paid before `paypalInvoiceId` is recorded locally because the payment link is only generated after local persistence. However, if a webhook arrives for an unknown invoice ID (or if PayPal sends an event out of order), `handlePaypalWebhookEvent` logs the event ID to `webhook_events` and marks it as ignored (`reason: "unknown_invoice"`), precluding future reconciliation if the event is retried.
* **Evidence:** `lib/invoices/webhooks.ts:34-37` (`if (!synced) return { duplicate: false, ignored: true, applied: false, reason: "unknown_invoice" };`).
* **Severity:** MEDIUM
* **Suggested Fix:** Do not permanently commit the webhook event record to `webhook_events` if `syncInvoiceByPaypalId` returns `unknown_invoice`, allowing retries to succeed once the local row exists.

### 13. Concurrency on Daily Reminder Cap
* **Answer:** The daily limit of 2 reminders per UTC day is scoped per invoice and evaluated via `countRemindersSince`. However, there is a Time-Of-Check to Time-Of-Use (TOCTOU) race condition: concurrent triggers (e.g., simultaneous UI clicks or a user action overlapping with the cron sweep) can both read count = 1 and both issue PayPal reminder emails. If PayPal's API call fails, `insertReminder` is not called, so failed reminders do not consume the budget.
* **Evidence:** `lib/invoices/remind.ts:136` (`countRemindersSince(invoice.id, utcDayStart(now))`), `lib/invoices/remind.ts:148-156`.
* **Severity:** MEDIUM
* **Suggested Fix:** Add a database unique constraint on `(invoice_id, utc_date, slot_number)` or enforce a lock during reminder issuance.

### 14. Mark-as-Paid & Webhook Interaction
* **Answer:** There is no public user-facing `mark-as-paid` or `record-payment` API route in the application; payments are recorded exclusively through PayPal webhook events or the status sync endpoint. Status updates are idempotent: `applyWebhookStatus("PAID", "PAID")` returns `{ applied: false, reason: "noop" }`, preventing duplicate transitions or redundant audit log rows.
* **Evidence:** `lib/invoices/state.ts:67` (`if (from === to) return { applied: false, reason: "noop" };`), `lib/invoices/sync.ts:86-98`.
* **Severity:** OK
* **Suggested Fix:** None required.

---

## C. Security

### 15. Route Enumeration & Access Gate Audit
* **Answer:** Only `/api/chat`, `/api/invoices/confirm`, and `/api/invoices/[id]/remind` are protected by the demo access gate. All React Server Component pages (`/dashboard`, `/invoices`, `/invoices/[id]`, `/activity`) and endpoints `/api/invoices/[id]/sync`, `/api/invoices/[id]/qr`, and `/api/invoices/reconcile` have no authentication or access checks, allowing unauthenticated public callers to view client names, amounts, and audit logs. The unlock cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production, but its value is the raw plaintext access code rather than a signed HMAC token. Code comparison is constant-time via `timingSafeEqualString`.
* **Evidence:** `lib/access/abuse.ts:64-69`, `lib/access/demo-code.ts:8-16`, `lib/access/demo-code.ts:66-80`, `app/api/invoices/reconcile/route.ts:1-20`.
* **Severity:** HIGH
* **Suggested Fix:** Protect dashboard, invoice, and activity pages with session authentication or extend the demo access gate across all data-exposing routes.

### 16. Webhook Simulator Exposure
* **Answer:** `/api/webhooks/simulate` is restricted to `PAYPAL_MODE=sandbox`, rejecting production requests with HTTP 403. However, in sandbox or public demo deployments, the endpoint has no authentication: any internet caller who posts `{ invoiceId }` to this endpoint can mark any invoice in the ledger as `PAID`.
* **Evidence:** `app/api/webhooks/simulate/route.ts:9-14`.
* **Severity:** HIGH
* **Suggested Fix:** Gate `/api/webhooks/simulate` behind demo access verification (`denyIfAbusive(req, { requireAccess: true })`) and disable the route completely in production builds.

### 17. CRON_SECRET and MCP Bearer Authentication
* **Answer:** `CRON_SECRET` and `MCP_BEARER_TOKEN` fail closed with HTTP 401 when unset in production (`process.env.NODE_ENV === "production"`). Comparison is performed in constant time using `timingSafeEqualString`. Neither secret is logged or echoed in HTTP error payloads.
* **Evidence:** `lib/invoices/cron-auth.ts:6-14`, `lib/access/mcp-bearer.ts:20-27`, `app/api/mcp/route.ts:12-16`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 18. Rate Limiting Architecture & Spoofability
* **Answer:** Rate limiting and daily usage counters are held entirely in ephemeral in-memory `Map` structures (`rateCounts`, `dailyCounts`). Consequently, limits reset on every server restart and fail to synchronize across multi-container or serverless deployments. Additionally, `clientIp` trusts `request.headers.get("x-forwarded-for")`, allowing an attacker to bypass IP rate limits by injecting randomized `X-Forwarded-For` headers.
* **Evidence:** `lib/access/abuse.ts:17-18`, `lib/access/abuse.ts:33-42`.
* **Severity:** HIGH
* **Suggested Fix:** Store rate counters in a shared store (e.g., Redis or Upstash) and read client IP addresses only from trusted reverse proxy headers.

### 19. Prompt Injection Surface & Tool Containment
* **Answer:** Untrusted user input enters prompts via chat messages (`app/api/chat`), invoice facts in reminder copy (`lib/invoices/reminder-copy.ts`), and risk facts in "Why?" explanations (`lib/insights/why.ts`). Untrusted strings are sanitized with `sanitizeUntrustedText`. Most importantly, prompt injection cannot trigger unauthorized financial movement because the language model is exposed only to read tools and `proposeInvoice` (which writes local drafts); PayPal create and send tools are strictly omitted from the model's tool registry.
* **Evidence:** `lib/agent/tools.ts:13-18`, `tests/prompt-injection.test.ts:17-26`, `lib/sanitize.ts:6-16`.
* **Severity:** OK
* **Suggested Fix:** Continue isolating execution tools behind human-in-the-loop application boundaries.

### 20. XSS & Reminder Note Phishing
* **Answer:** The application does not use `dangerouslySetInnerHTML` for model outputs; messages and notes are rendered via standard JSX string nodes, preventing DOM XSS. While prompt instructions forbid links, `parseReminderCopy` does not strip `https://` URLs, creating a minor vector where an adversarial model completion could include an arbitrary URL in the PayPal reminder note sent by PayPal's servers. PayPal field length limits (80 for subject, 500 for note, 4,000 in API) are strictly clipped.
* **Evidence:** `lib/invoices/reminder-copy.ts:107-108`, `lib/paypal/invoicing.ts:167-168`, `app/layout.tsx:30`.
* **Severity:** LOW
* **Suggested Fix:** Add a regex filter to `parseReminderCopy` that strips all URL schemes (`https?://`) from generated reminder notes before dispatch.

### 21. Secrets & Leak Audit
* **Answer:** A full git history scan of all 51 commits using `gitleaks` found zero leaked credentials. No `NEXT_PUBLIC_` environment variables exist in the project. `/api/health` and `/api/health/live` pass checks through redaction helpers (`publicEnv`, `publicDb`, `publicPaypal`, `publicLlm`), and audit log payloads redact sensitive keys matching `/secret|token|password|authorization|api[_-]?key/i`.
* **Evidence:** `gitleaks git --verbose` (0 leaks), `lib/health/public.ts:5-40`, `lib/db/redact.ts:1-20`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 22. SQL Injection Verification
* **Answer:** The codebase contains zero instances of raw SQL string interpolation, raw `execute()`, or unescaped `sql`` template literals. All database interactions utilize Drizzle ORM's parameterized schema query builders.
* **Evidence:** Verified across all repositories in `lib/db/repositories/`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 23. Outbound Fetch & SSRF Validation
* **Answer:** All outbound `fetch` targets are static constants or derived from validated configuration (`https://api.frankfurter.dev`, `https://api-m.sandbox.paypal.com`, Azure/OpenAI endpoints). No user-controlled URLs are fetched, eliminating SSRF risks. All external responses are validated using strict Zod schemas before consumption.
* **Evidence:** `lib/paypal/client.ts:48,109`, `lib/fx/quote.ts:48`, `lib/paypal/schemas.ts`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 24. CSRF, CORS, Security Headers, npm Audit & Dockerfile
* **Answer:** Security headers (HSTS, CSP, X-Frame-Options) are missing from `next.config.ts`. `/api/mcp` does not include CORS headers. `npm audit` reports 22 vulnerabilities (including 2 critical in `tinypool`/`vitest` and 10 high in dependencies pulled by `@paypal/agent-toolkit`). The `Dockerfile` runs as the root user without specifying `USER node`.
* **Evidence:** `next.config.ts:1-29`, `Dockerfile:1-17`, `npm audit` output.
* **Severity:** HIGH
* **Suggested Fix:** Add security headers to `next.config.ts`, add `USER node` to the Dockerfile, and run `npm audit fix` for development dependencies.

### 25. PII Storage, Privacy Policy & Retention
* **Answer:** Client names and email addresses are stored in plaintext in the `clients` table, the `invoices` table, and `audit_log.payload` (which redacts only auth credentials, not PII). No privacy policy or retention lifecycle is defined in the repository, and data persists indefinitely.
* **Evidence:** `lib/db/repositories/audit-log.ts:22`, `lib/db/schema.ts:11-18`.
* **Severity:** LOW
* **Suggested Fix:** Add a privacy disclaimer in the documentation and add email masking in client audit log displays.

---

## D. PayPal Integration

### 26. Token Handling & Refresh Stampede
* **Answer:** OAuth tokens are cached with a 60-second expiry buffer and support a single 401 retry with cache invalidation. However, `getAccessToken` lacks concurrency locking: if the token expires, multiple simultaneous inbound requests will all initiate duplicate `/v1/oauth2/token` network requests simultaneously (stampede). There is no backoff for HTTP 429 and no `AbortSignal.timeout` on outbound PayPal requests.
* **Evidence:** `lib/paypal/client.ts:19-20`, `lib/paypal/client.ts:75-81`, `lib/paypal/client.ts:115-118`.
* **Severity:** MEDIUM
* **Suggested Fix:** Store an inflight `Promise<string>` during token refresh to coalesce concurrent token requests, and add `AbortSignal.timeout(10000)` to `paypalRequest`.

### 27. Invoice Numbering & 422 Error Handling
* **Answer:** Invoice numbers are not created locally; PayPilot delegates sequential number assignment to PayPal's Invoicing v2 API, avoiding collisions. HTTP 422 validation errors are parsed and details (`field`, `issue`, `description`) are mapped into user-readable error strings.
* **Evidence:** `lib/paypal/invoicing.ts:73-90`, `lib/paypal/errors.ts:40-85`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 28. Delivered URLs and Payload Fields
* **Answer:** The application specifically searches for and returns `rel === "payer-view"`, ensuring buyers receive the public checkout page rather than the merchant view. The payload populates `currency_code`, `note`, `payment_term` (`due_date` or `NET_10`), `primary_recipients`, and `items` (`name`, `description`, `quantity`, `unit_amount`). Partial payments, terms & conditions, and custom merchant info are not populated.
* **Evidence:** `lib/paypal/invoicing.ts:73-90`, `lib/paypal/invoicing.ts:136-143`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 29. Verification of `send_to_recipient: false`
* **Answer:** Calling `/v2/invoicing/invoices/{id}/send` with `{ send_to_recipient: false, send_to_invoicer: false }` successfully transitions the invoice to `SENT` on PayPal's sandbox servers without emailing the customer, returning a valid `payer-view` URL. This is verified by unit tests and live sandbox invoice responses showing `status: UNPAID`.
* **Evidence:** `lib/paypal/invoicing.ts:132`, `tests/paypal-invoicing.test.ts:95-104`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 30. Agent Toolkit Tool Confinement
* **Answer:** The AI model is strictly confined in code to local agent tools; write tools from `@paypal/agent-toolkit` (`create_invoice`, `send_invoice`) are never registered with the model and are tested to ensure they are unreachable. Toolkit read tools are restricted to read-only operations. Version is set to `"^1.11.0"` in `package.json` (unpinned patch version). Tool outputs are not bounded by length caps.
* **Evidence:** `lib/agent/tools.ts:13-18`, `tests/prompt-injection.test.ts:17-26`, `package.json:27`.
* **Severity:** LOW
* **Suggested Fix:** Pin `@paypal/agent-toolkit` to exact version `1.11.0` in `package.json`.

### 31. Webhook Subscriptions vs Handling
* **Answer:** The registration script subscribes to `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`. These two events are fully handled by updating the local invoice status. Other events (such as `REFUNDED` or `PAYMENT.CAPTURE.COMPLETED`) are recorded in `webhook_events` but silently perform no ledger transitions.
* **Evidence:** `scripts/register-paypal-webhook.ts:5-8`, `lib/invoices/webhooks.ts:31-45`.
* **Severity:** OK
* **Suggested Fix:** None required; documented behavior aligns with implementation.

### 32. Reconcile Pagination & Live Mode Guard
* **Answer:** Reconcile pagination iterates through all pages up to 10 pages of 100 items (1,000 invoice limit) via `listAllPaypalInvoices`. However, there is no hard guard prohibiting `PAYPAL_MODE=live`: if live credentials and `PAYPAL_MODE=live` are configured in `.env.local`, the application will target PayPal's live production endpoints (`https://api-m.paypal.com`).
* **Evidence:** `lib/paypal/invoicing.ts:237-260`, `lib/env.ts:14` (`z.enum(["sandbox", "live"]).default("sandbox")`), `lib/env.ts:106-110`.
* **Severity:** MEDIUM
* **Suggested Fix:** Add an explicit confirmation or guard in `lib/env.ts` preventing startup if `PAYPAL_MODE === "live"` during hackathon testing.

### 33. QR Code Error Handling & Caching
* **Answer:** QR code generation requests `/v2/invoicing/invoices/{id}/generate-qr-code`. If generation fails, `/api/invoices/[id]/qr` returns an HTTP error, and the client component `InvoiceQr` silently catches the error and renders `null` without an error notification. QR codes are not cached locally in SQLite.
* **Evidence:** `app/api/invoices/[id]/qr/route.ts:30-35`, `components/invoice-qr.tsx:21-32`.
* **Severity:** LOW
* **Suggested Fix:** Display a placeholder or retry button in `InvoiceQr` when the image fails to load.

---

## E. AI Quality

### 34. Parser Edge-Case Performance
* **Answer:** Test suites in `lib/agent/evals.ts` verify parser behavior across:
  - Multiple client emails: rejected with `null` (`hold-two-clients`).
  - Missing email: rejected with `invalid_email` (`reject-bad-email`).
  - Ambiguous `$`: defaults to USD; euros/pounds rejected (`hold-euros`).
  - "40k": parsed as 4,000,000 cents (`amt-usd-40k`).
  - Lakh/Crore: unsupported (no regex matches).
  - Relative dates: rejected at schema level if not converted to `YYYY-MM-DD` (`hold-relative-due-schema`).
  - Long threads: parsed correctly (`hold-long-thread`).
* **Evidence:** `lib/agent/evals.ts:25-146`, `scripts/eval.ts`.
* **Severity:** OK
* **Suggested Fix:** Add support for Indian numbering terms (lakh, crore) in `lib/money.ts`.

### 35. Missing Fields & Incomplete Proposals
* **Answer:** Missing fields are enforced in code through `evaluateProposal` before saving a proposal. If `clientEmail`, `clientName`, or line items are missing, no invoice record is saved to the database, ensuring users cannot confirm an incomplete proposal. Explicit `confidence` metrics and `missingFields` arrays are not implemented.
* **Evidence:** `lib/agent/propose.ts:51-86`, `lib/agent/propose-save.ts:45-48`.
* **Severity:** OK
* **Suggested Fix:** None required.

### 36. Eval Validity & CI Gating
* **Answer:** Evals are deterministic unit evaluations executed against parser and policy functions (`parseChatAmount` and `evaluateProposal`), requiring no LLM calls. Held-out cases (15/15 passing, baseline 6/15) are honestly reported in `scripts/eval.ts`. However, evals and tests are not run in CI because no GitHub Actions test workflow exists.
* **Evidence:** `scripts/eval.ts:6-60`, `.github/workflows/` (lacks CI runner).
* **Severity:** MEDIUM
* **Suggested Fix:** Create `.github/workflows/ci.yml` that runs `npm test` and `npm run eval` on every push and pull request.

### 37. LLM Failure Modes & Input Limits
* **Answer:** The chat endpoint lacks input length constraints on inbound messages: a 100,000-character payload will be accepted by `chatBodySchema` and sent directly to the model. In the event of Azure 429 rate limits, content filtering, or timeouts, `chatStreamErrorMessage` catches the error and returns a generic fallback: `"Chat failed. Try again."`.
* **Evidence:** `app/api/chat/route.ts:17-19`, `lib/agent/stream-error.ts:9`.
* **Severity:** MEDIUM
* **Suggested Fix:** Add a `.max(4000)` character limit on message content in `chatBodySchema`, and map Azure rate-limit errors to `"LLM service busy. Please wait a moment."`.

### 38. Tool Loop Bounds & Budget Exhaustion
* **Answer:** The chat loop is bounded by `stopWhen: stepCountIs(5)`, preventing infinite tool recursion. However, because daily LLM limits are tracked in memory, an attacker can trigger 80 separate requests of 5 steps each (up to 400 LLM calls per day) from a single IP, or bypass the IP limit using spoofed headers to exhaust API quotas.
* **Evidence:** `app/api/chat/route.ts:67`, `lib/access/abuse.ts:82-86`.
* **Severity:** MEDIUM
* **Suggested Fix:** Enforce a per-IP daily call limit and count individual model execution steps against the daily budget.

### 39. Grounding in "Why?" Explanations
* **Answer:** The "Why?" prompt supplies only pre-computed deterministic facts (`riskScore`, `riskBand`, `lateRate`, `avgDaysToPay`, `openOverdueCount`, `openOverdueUsd`). However, there is no programmatic post-verification check to confirm that the generated narrative does not introduce ungrounded figures or hallucinations.
* **Evidence:** `lib/insights/why.ts:8-22`, `lib/insights/why.ts:31-35`.
* **Severity:** LOW
* **Suggested Fix:** Add a lightweight regex validator ensuring all numbers mentioned in the generated explanation match values present in the input facts.

### 40. Cash Forecast Math & Horizon Discrepancy
* **Answer:** Risk score math handles division by zero safely. Brand new clients with no history default to score 0 (low risk). The cash forecast math computes a **6-week horizon** based on client payment slip-days. A documentation discrepancy exists: marketing pitches referencing a "30/60/90-day forecast" contradict the code, which strictly calculates 6 UTC weeks.
* **Evidence:** `lib/insights/forecast.ts:28-40` (`length: 6`), `lib/insights/behavior.ts:21-29`.
* **Severity:** MEDIUM
* **Suggested Fix:** Align all documentation, pitch decks, and UI tooltips to state "6-week cash forecast".

---

## F. Data, Infra, and Ops

### 41. Database Reliability & Seed Separation
* **Answer:** Drizzle migrations are idempotent. SQLite and Turso indices exist on `paypal_invoice_id`, `status`, `client_id`, and `webhook_events.event_id`, but `due_date` lacks an index. Multi-step operations (`insertClient` ➔ `insertInvoice` ➔ `insertAuditLog`) are executed without database transactions. Demo seed invoices (`is_demo = true`) are not separated from real invoices in dashboard metrics or risk scoring.
* **Evidence:** `drizzle/0000_init.sql:10-54`, `lib/invoices/views.ts:25-29`, `lib/agent/propose-save.ts:50-65`.
* **Severity:** MEDIUM
* **Suggested Fix:** Add an index on `invoices.due_date`, wrap multi-table insertions in `database.transaction()`, and add an `isDemo` toggle filter to the dashboard.

### 42. Deployment, Cold Starts & Keep-Alive
* **Answer:** The app runs on Render's free tier, which spins down containers after 15 minutes of inactivity; cold starts can take 50–90 seconds. To counteract this, `.github/workflows/keepalive.yml` pings `/api/health/live` every 10 minutes. The `Dockerfile` lacks a `HEALTHCHECK` directive. Missing required environment variables cause friendly error messages in `/api/health` rather than crash loops.
* **Evidence:** `render.yaml:8-9`, `.github/workflows/keepalive.yml:4-6`, `Dockerfile:1-17`.
* **Severity:** LOW
* **Suggested Fix:** Add `HEALTHCHECK CMD curl -f http://localhost:10000/api/health/live || exit 1` to `Dockerfile`.

### 43. Observability & Error Handling
* **Answer:** Logging relies on unstructured `console.error` calls. Request IDs are not propagated. Over 30 empty `catch {}` blocks exist across the codebase, swallowing unexpected errors silently. There is no root `app/error.tsx` or `app/global-error.tsx` boundary, meaning uncaught client component exceptions will crash the entire page view.
* **Evidence:** `app/layout.tsx:41`, `components/invoice-qr.tsx:22`, `lib/paypal/invoicing.ts:55`.
* **Severity:** HIGH
* **Suggested Fix:** Create `app/error.tsx` to handle client rendering errors gracefully, and replace empty catch blocks with structured error logging.

### 44. Test Coverage & Missing Integration Flows
* **Answer:** Unit test coverage is comprehensive (126 passing tests across 25 suites), with deterministic date mocks preventing flakiness. However, all PayPal API interactions are mocked, meaning upstream contract changes in PayPal Invoicing v2 would not be detected. There is no end-to-end integration test exercising the full lifecycle: `propose ➔ confirm ➔ webhook ➔ PAID`.
* **Evidence:** `tests/paypal-invoicing.test.ts:1-20`, `npm test` output.
* **Severity:** MEDIUM
* **Suggested Fix:** Add an end-to-end integration test tracing an invoice from proposal through confirmation and webhook state reconciliation.

---

## G. UX and Product

### 45. Accessibility & Responsiveness
* **Answer:** Main screens feature responsive column stacking and horizontal scrolling tables. Keyboard accessibility on the confirmation card allows button focus, but lacks modal focus trapping and Escape-key listeners. Some zinc text tokens in light mode approach WCAG AA 4.5:1 minimum contrast limits.
* **Evidence:** `components/confirmation-card.tsx:180-230`, `components/client-risk-grid.tsx:217`.
* **Severity:** LOW
* **Suggested Fix:** Add keyboard Escape-key dismissal to modal dialogs and increase font contrast on secondary labels in light mode.

### 46. Confirmation Card Completeness
* **Answer:** The confirmation card displays recipient name, email, items, quantities, unit prices, total USD, due date terms, note, and the email-dispatch toggle. However, if a line item contains a detailed `description`, that description is sent to PayPal in `items[].description` but is omitted from the confirmation card interface.
* **Evidence:** `components/confirmation-card.tsx:120-170`, `lib/paypal/invoicing.ts:65`.
* **Severity:** LOW
* **Suggested Fix:** Render line item descriptions beneath line item titles in `ConfirmationCard`.

### 47. Dashboard Integrity & Scale
* **Answer:** Dashboard totals and KPIs compute values over all invoices in the database without distinguishing between seeded demo records and user-created invoices. At 10,000 rows, AG Grid's client-side loading would introduce significant initial render latency without server-side pagination.
* **Evidence:** `app/dashboard/page.tsx:20-50`, `components/client-risk-grid.tsx:225`.
* **Severity:** LOW
* **Suggested Fix:** Add a badge distinguishing live invoices from demo seed data in dashboard summary cards.

### 48. Human-in-the-Loop Integrity vs. Cron Reminders
* **Answer:** While the chat interface strictly adheres to human-in-the-loop rules (requiring manual confirmation before PayPal is contacted), the background cron job (`/api/cron/reminders` / `/api/cron/overdue`) automatically generates LLM reminder copy and dispatches emails to real clients via PayPal without human review. This contradicts broad claims that "nothing happens without your confirmation."
* **Evidence:** `lib/invoices/remind.ts:182-228` (`runOverdueReminderSweep`), `app/api/cron/overdue/route.ts`.
* **Severity:** HIGH
* **Suggested Fix:** Introduce an explicit `autoRemindEnabled` boolean flag on clients/invoices, defaulting to false, and clearly disclose automated reminders in documentation.

---

## H. Submission and Judging

### 49. Claims Audit

| Claim in Docs / Pitch | Verified in Repo? | Evidence / File Reference | Status | Suggested Rewrite |
| :--- | :---: | :--- | :---: | :--- |
| **"Orders / Payments REST APIs"** | ❌ No | Only Invoicing v2 is used (`lib/paypal/invoicing.ts`) | **UNSUPPORTED** | "Uses PayPal Invoicing v2 REST APIs" |
| **"14 hours a month chasing invoices"** | ❌ No | No empirical source in repository | **UNSUPPORTED** | Drop specific statistic; say "Freelancers spend significant time chasing invoices" |
| **"30/60/90-day cash flow forecast"** | ❌ No | `lib/insights/forecast.ts:40` calculates 6 weeks | **UNSUPPORTED** | "6-week cash forecast based on payment slip history" |
| **"Tax handling in confirmation card"** | ❌ No | `lib/agent/schema.ts` has no tax fields | **UNSUPPORTED** | Remove all tax mentions |
| **"Entire platform powered by MCP"** | ⚠️ Partial | Exposes an MCP server for external agents; app itself uses Vercel AI SDK | **IMPRECISE** | "Exposes an MCP server so external agents like Claude Desktop can propose drafts" |
| **"Cryptographically verified webhooks"** | ✅ Yes | `verifyPaypalWebhookSignature` in `lib/paypal/webhooks.ts` | **VERIFIED** | Keep as is |
| **"AI never moves money without confirmation"** | ⚠️ Partial | True for chat invoices; untrue for background cron reminder sweep | **QUALIFIED** | "AI never sends an invoice without human confirmation" |
| **"Live ECB FX rates via Frankfurter"** | ✅ Yes | `lib/fx/quote.ts` calls Frankfurter API with env fallback | **VERIFIED** | Keep as is |

---

### 50. Judge Simulation & Weakness Analysis

#### Scoring Breakdown (1–10 Scale)

* **PayPal API Depth: 8.5 / 10**  
  * *Justification:* Implements Invoicing v2 comprehensively (draft creation, share links, detail retrieval, QR generation, reminders, status sync, and cryptographic webhook verification). Does not integrate Orders, Subscriptions, or PayPal Checkout SDKs.
* **AI Agent Depth: 8.0 / 10**  
  * *Justification:* Strong tool-calling containment, deterministic policy enforcement, evals suite (15/15 held-out), and MCP server integration. Loses points because prompt injection defense is structural rather than semantic, and explanation outputs lack fact-checking validators.
* **Completeness & Polish: 8.5 / 10**  
  * *Justification:* Dual themes, AG Grid tables, live webhook simulator, responsive design, and 126 passing tests. Missing UI error boundaries and CSRF/security headers.
* **Demo Quality: 9.0 / 10**  
  * *Justification:* Exceptional demo flow when following the real sandbox payment path; clear visual progression from messy chat to PayPal hosted checkout to automated webhook reconciliation.
* **Real-World Problem: 9.0 / 10**  
  * *Justification:* Directly addresses freelance invoicing delays and cash flow unpredictability with deterministic math and risk scoring.

#### Top 5 Failure Modes During Live Judging

1. **Cold Start Delay:** If judged on Render's free tier after 15 minutes of inactivity, judges will experience a 60–90 second page load freeze.
2. **In-Memory Rate Limiting Exhaustion:** If multiple judges test the deployed app simultaneously, the global daily limit of 80 LLM calls will trigger HTTP 429 errors for subsequent judges.
3. **Cron Auto-Send Disclosure:** Judges reviewing the codebase will discover that `/api/cron/reminders` emails clients automatically, contradicting the zero-unconfirmed-actions claim.
4. **Unauthenticated Data Exposure:** Judges inspecting network requests will notice that `/dashboard`, `/invoices`, and `/activity` lack authentication, exposing client names and amounts.
5. **Simulated vs. Real Webhook Skepticism:** If the presenter uses the Webhook Simulator rather than demonstrating an actual sandbox payment, skeptical judges may suspect the entire PayPal rail is mocked.

---

## Final Output & Action Plan

### 1. Summary Findings Table

| # | Question / Topic | Severity | One-Line Finding |
| :-: | :--- | :---: | :--- |
| **1** | Integer Cents Consistency | LOW | Cents used everywhere; float math in minorUnits rounding should use integer split. |
| **2** | INR ➔ USD Rounding | OK | Aggregate rounding with ±1 cent tolerance; zero-decimal currencies unsupported. |
| **3** | MAX_INVOICE_USD Cap | OK | Cap ($5,000) enforced both at proposal evaluation and confirm endpoints. |
| **4** | Confirm Server Validation | MEDIUM | Validates server-side, but lacks user authentication to prevent ID enumeration. |
| **5** | FX Rate Stored vs Used | OK | Proposal rate is persisted to DB and reused at confirmation; fallback is robust. |
| **6** | Due Date Boundary | MEDIUM | Off-by-one: invoices evaluate as OVERDUE at 00:00:01 UTC on the due date itself. |
| **7** | Taxes / Discounts | OK | Code does not support taxes or discounts; documentation must not claim them. |
| **8** | Confirm Idempotency | OK | Stable PayPal-Request-Id header prevents duplicate PayPal drafts on retry. |
| **9** | Partial Failure Recovery | OK | Saved draft resumes send on retry; background reconcile repairs unlinked records. |
| **10** | State Machine Mapping | LOW | Validated transitions; unmapped PayPal refund statuses silently ignored. |
| **11** | Webhook Dedupe Flaw | HIGH | Event ID inserted before sync; failed sync permanently loses webhook retries. |
| **12** | Webhook Race Condition | MEDIUM | Events for unknown invoices are permanently logged and skipped without retry. |
| **13** | Reminder Cap Concurrency | MEDIUM | TOCTOU race condition exists between concurrent UI clicks and cron sweeps. |
| **14** | Record-Payment Safety | OK | No manual record-payment route exists; sync/webhook transitions are idempotent. |
| **15** | Route Access Gate | HIGH | Dashboard, Invoices, and Activity pages are completely unauthenticated. |
| **16** | Webhook Simulator Auth | HIGH | In sandbox mode, anyone can POST to `/api/webhooks/simulate` and mark invoices PAID. |
| **17** | CRON & MCP Secret Handling | OK | Fails closed in production; constant-time comparison; tokens are never logged. |
| **18** | Rate Limit Storage | HIGH | Limits stored in memory; resets on restart and spoofable via X-Forwarded-For. |
| **19** | Prompt Injection Containment | OK | PayPal write tools are never exposed to LLM; untrusted text sanitized. |
| **20** | XSS & Reminder Note Safety | LOW | No HTML rendering of model output; reminder notes lack outbound URL stripping. |
| **21** | Secrets & Git Leaks | OK | Gitleaks verified 0 leaks across all commits; no NEXT_PUBLIC_ variables; health checks redacted. |
| **22** | SQL Injection | OK | Parameterized queries used everywhere via Drizzle ORM; zero raw SQL strings. |
| **23** | SSRF & Fetch Validation | OK | All outbound endpoints are static or trusted base URLs; all payloads validated via Zod. |
| **24** | CSRF, CORS & Dockerfile | HIGH | Security headers and CORS on `/api/mcp` are missing; Dockerfile runs as root. |
| **25** | PII & Privacy Lifecycle | LOW | Client emails stored plaintext in audit logs; no retention or privacy policy. |
| **26** | OAuth Token Stampede | MEDIUM | Concurrent requests on expired token trigger simultaneous OAuth refresh calls. |
| **27** | Invoice Numbering | OK | Numbers generated by PayPal sequentially; 422 error details mapped to UI. |
| **28** | URL Target Verification | OK | Payer-view link verified and delivered; partial payments and terms omitted. |
| **29** | send_to_recipient: false | OK | Confirmed: transitions to SENT on PayPal and generates active hosted URL without emailing. |
| **30** | Agent Toolkit Confinement | LOW | Write tools omitted in code and verified by tests; toolkit package unpinned. |
| **31** | Webhook Subscriptions | OK | PAID and CANCELLED subscribed and handled; others recorded as no-op. |
| **32** | Reconcile Pagination & Mode | MEDIUM | Paginates up to 1,000 invoices; lacks hard guard against setting PAYPAL_MODE=live. |
| **33** | QR Code Handling | LOW | Silent failure on QR generation error; no client-side caching. |
| **34** | Parser Edge Cases | OK | Tests cover multiple clients, missing emails, 40k, and long threads. |
| **35** | Proposal Completeness | OK | Server evaluation rejects incomplete proposals before database persistence. |
| **36** | Eval Validity & CI | MEDIUM | 15/15 held-out tests are deterministic, but no GitHub Actions CI workflow exists. |
| **37** | LLM Length Caps & Errors | MEDIUM | Chat input unbounded by length caps; Azure errors return generic message. |
| **38** | Tool Loop Budget Bounds | MEDIUM | Max 5 steps per turn, but in-memory limit allows up to 400 LLM calls per day. |
| **39** | Why? Explanation Grounding | LOW | Input facts are deterministic, but generated text lacks post-check verification. |
| **40** | Forecast Horizon Mismatch | MEDIUM | Code strictly implements a 6-week horizon; docs claiming 30/60/90 are wrong. |
| **41** | Database Transactions | MEDIUM | Multi-table insertions lack transactions; missing index on `invoices.due_date`. |
| **42** | Deployment & Keep-Alive | LOW | Keep-alive workflow pings every 10 min, but Dockerfile lacks HEALTHCHECK. |
| **43** | Observability & Boundaries | HIGH | No root error boundary (`app/error.tsx`); 30+ empty catch blocks swallow errors. |
| **44** | End-to-End Tests | MEDIUM | Full unit coverage, but missing an integration test tracing propose to paid webhook. |
| **45** | Accessibility & Contrast | LOW | Inline confirmation card lacks modal focus trapping and Escape-key handling. |
| **46** | Confirmation Card Details | LOW | Line item descriptions are passed to PayPal but hidden from the confirmation card. |
| **47** | Dashboard Demo Labeling | LOW | Dashboard totals combine demo seed data and real invoices without visual separation. |
| **48** | Cron Reminders vs. HITL | HIGH | Background cron emails clients without human confirmation, contradicting pitch. |
| **49** | Claims Audit | HIGH | Claims of Orders API, tax handling, 14 hours stat, and 30/60/90 days are unsupported. |
| **50** | Judge Live Failure Modes | HIGH | Cold starts, in-memory rate limit exhaustion, and cron discrepancies threaten live judging. |

---

### 2. Top 10 Fixes Ranked by Impact / Effort

#### 1. Fix Webhook Deduplication Data Loss (Q11)
* **Impact:** Prevents permanent loss of legitimate PayPal payment webhook retries.
* **Effort:** 15 minutes.
* **Files:** `lib/invoices/webhooks.ts`, `lib/db/repositories/webhook-events.ts`.
* **Fix Prompt:**
  ```text
  In lib/invoices/webhooks.ts, modify handlePaypalWebhookEvent so that recordWebhookEvent is called ONLY after syncInvoiceByPaypalId successfully completes, or delete the webhook_events record in a catch block if sync throws. Ensure failed processing allows PayPal webhook retries to be processed.
  ```

#### 2. Create Root Error Boundary (`app/error.tsx`) (Q43)
* **Impact:** Prevents uncaught React render exceptions from crashing the application during judging.
* **Effort:** 10 minutes.
* **Files:** `app/error.tsx`.
* **Fix Prompt:**
  ```text
  Create app/error.tsx as a client component with 'use client'. Include an error boundary UI displaying a clean card with "Something went wrong", a retry button calling reset(), and a link back to "/".
  ```

#### 3. Correct Overdue Date Boundary Math (Q6)
* **Impact:** Eliminates premature OVERDUE status for invoices on the day they are due.
* **Effort:** 5 minutes.
* **Files:** `lib/invoices/state.ts`.
* **Fix Prompt:**
  ```text
  In lib/invoices/state.ts, update displayStatus so that an invoice is marked OVERDUE only when now >= invoice.dueDate + 86_400_000. Ensure invoices remain in SENT status throughout their active due date.
  ```

#### 4. Reconcile Documentation & Pitch Horizon Claims (Q40, Q49)
* **Impact:** Eliminates credibility loss during judge code inspection.
* **Effort:** 10 minutes.
* **Files:** `README.md`, `DEMO.md`, pitch script.
* **Fix Prompt:**
  ```text
  Search README.md and DEMO.md for "30/60/90", "taxes", "Orders API", and "14 hours". Replace "30/60/90-day" with "6-week cash forecast based on payment slip history". Remove references to Orders/Payments APIs, taxes, and unsourced statistics.
  ```

#### 5. Restrict Webhook Simulator to Demo Access Gate (Q16)
* **Impact:** Closes an unauthorized endpoint that allows anyone to mark invoices as PAID in sandbox deployments.
* **Effort:** 10 minutes.
* **Files:** `app/api/webhooks/simulate/route.ts`.
* **Fix Prompt:**
  ```text
  In app/api/webhooks/simulate/route.ts, add denyIfAbusive(req, { requireAccess: true }) at the beginning of POST handler. Reject requests with 401 if demo access is not granted, and keep the existing PAYPAL_MODE === 'sandbox' check.
  ```

#### 6. Disclose or Gate Background Cron Reminders (Q48)
* **Impact:** Restores credibility of the Human-in-the-Loop safety claim.
* **Effort:** 15 minutes.
* **Files:** `app/api/cron/overdue/route.ts`, `README.md`.
* **Fix Prompt:**
  ```text
  In README.md and DEMO.md, explicitly document that the cron sweep is an optional opt-in background automation for overdue accounts. In app/api/cron/overdue/route.ts, ensure the sweep only processes invoices explicitly tagged with autoRemind: true (or document the actor: "cron" audit log clearly).
  ```

#### 7. Add GitHub Actions CI Test Workflow (Q36, Q44)
* **Impact:** Proves code quality and test hygiene on GitHub.
* **Effort:** 10 minutes.
* **Files:** `.github/workflows/ci.yml`.
* **Fix Prompt:**
  ```text
  Create .github/workflows/ci.yml running on push and pull_request to main. Have it checkout, setup-node 20 with cache: 'npm', run npm ci, npm test, and npm run eval.
  ```

#### 8. Prevent OAuth Token Refresh Stampede (Q26)
* **Impact:** Prevents 429 rate limiting from PayPal during concurrent demo traffic.
* **Effort:** 15 minutes.
* **Files:** `lib/paypal/client.ts`.
* **Fix Prompt:**
  ```text
  In lib/paypal/client.ts, introduce an inflightTokenPromise variable. When getAccessToken() determines a refresh is required, if inflightTokenPromise is active, return that promise; otherwise assign inflightTokenPromise = fetchAccessToken() and clear it upon completion.
  ```

#### 9. Add Missing Database Index on `due_date` (Q41)
* **Impact:** Speeds up overdue invoice filtering and forecast queries.
* **Effort:** 10 minutes.
* **Files:** `lib/db/schema.ts`, `drizzle/0003_due_date_idx.sql`.
* **Fix Prompt:**
  ```text
  In lib/db/schema.ts, add an index on invoices.dueDate. Generate a new migration using drizzle-kit or create drizzle/0003_due_date_idx.sql creating index invoices_due_date_idx on invoices(due_date).
  ```

#### 10. Add Non-Root User & Healthcheck to Dockerfile (Q24, Q42)
* **Impact:** Follows container security best practices for production deployment.
* **Effort:** 10 minutes.
* **Files:** `Dockerfile`.
* **Fix Prompt:**
  ```text
  In Dockerfile, add USER node before CMD, and add HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:10000/api/health/live || exit 1.
  ```

---

### 3. Top 5 Advanced Improvements (One-Week Horizon)

1. **Live PayPal Webhook Ingestion with Smee.io / ngrok Relay for Local Judging**
   * *Description:* Embed a built-in webhook tunnel client so judges running locally on `localhost:3000` receive real PayPal Sandbox webhooks without deploying to Render.
   * *Risks:* Third-party tunnel service rate limits or connection drops during evaluation.
2. **Deterministic Post-Generation Fact Verifier for AI Reminders and "Why?"**
   * *Description:* Add a lightweight validator using Zod and regex to verify that every dollar amount and day count in the LLM-generated text matches input data exactly before saving.
   * *Risks:* May reject creative phrasing if matching rules are too strict.
3. **Multi-Tenant User Isolation & Session Cookies**
   * *Description:* Implement NextAuth or iron-session so each user or judge sees their own isolated ledger and invoices rather than sharing a single global database.
   * *Risks:* Increases setup friction if judges must sign up with an email.
4. **PayPal Dispute & Chargeback Warning Tool**
   * *Description:* Integrate PayPal Dispute API webhooks (`CUSTOMER.DISPUTE.CREATED`) to alert the freelancer and flag delinquent clients automatically in the AG Grid risk matrix.
   * *Risks:* Requires simulating dispute sandbox events, which can be difficult to trigger reliably.
5. **PDF Export & Download for Offline Invoicing**
   * *Description:* Generate official PDF invoice copies using `@react-pdf/renderer` or PayPal's invoice detail export.
   * *Risks:* Font rendering issues in serverless runtimes.

---

### 4. Proposed List of Failing Tests to Add

*(Do not execute or add to repository; review for future coverage)*

```typescript
// Proposed Test 1: Webhook deduplication must not swallow failed syncs
it("does not permanently deduplicate a webhook if syncInvoiceByPaypalId throws", async () => {
  recordWebhookEventMock.mockResolvedValue(true);
  syncInvoiceByPaypalIdMock.mockRejectedValue(new Error("Database connection timeout"));
  await expect(handlePaypalWebhookEvent(mockEvent)).rejects.toThrow();
  // Expect eventId to be deleted from webhook_events so PayPal retries can succeed
});

// Proposed Test 2: Invoices on their active due date must remain SENT, not OVERDUE
it("evaluates active due date as SENT at 12:00 PM UTC on the due date", () => {
  const dueDateMs = Date.parse("2026-10-10T00:00:00.000Z");
  const noonOnDueDate = Date.parse("2026-10-10T12:00:00.000Z");
  const invoice = { status: "SENT", dueDate: dueDateMs };
  expect(displayStatus(invoice, noonOnDueDate)).toBe("SENT");
});

// Proposed Test 3: Concurrent token requests must coalesce into a single fetch
it("coalesces concurrent getAccessToken calls into a single network request", async () => {
  resetPaypalTokenCache();
  const promise1 = getAccessToken();
  const promise2 = getAccessToken();
  await Promise.all([promise1, promise2]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

// Proposed Test 4: Simulator endpoint must reject unauthenticated requests
it("rejects /api/webhooks/simulate requests without valid demo access cookie", async () => {
  const req = new Request("http://localhost:3000/api/webhooks/simulate", { method: "POST" });
  const res = await POST(req);
  expect(res.status).toBe(401);
});

// Proposed Test 5: End-to-end integration: propose -> confirm -> webhook -> PAID
it("completes full lifecycle from proposed invoice to confirmed to paid webhook", async () => {
  const proposal = await saveProposedInvoice(mockProposal, "chat");
  const confirmed = await confirmInvoice(proposal.invoiceId);
  expect(confirmed.status).toBe("SENT");
  const webhookResult = await handlePaypalWebhookEvent({
    id: "WH-E2E",
    event_type: "INVOICING.INVOICE.PAID",
    resource: { id: confirmed.paypalInvoiceId, status: "PAID" },
  });
  expect(webhookResult.applied).toBe(true);
  const finalView = await getInvoiceView(proposal.invoiceId);
  expect(finalView.displayStatus).toBe("PAID");
});
```

---

### 5. Go / No-Go Call for Making the Repository Public

> ### **VERDICT: GO (With 3 Immediate Remediation Steps)**
>
> **Rationale:**  
> The repository is in strong technical shape: **all 126 unit tests pass**, zero secrets were detected across 51 git commits, Drizzle parameterization completely prevents SQL injection, and the core agentic architecture strictly decouples LLM generation from PayPal financial writes.
>
> However, before sharing the repository URL with hackathon judges or the public, complete the following three quick tasks:
> 1. **Align Pitch Claims with Code:** Drop unsupported claims (Orders API, taxes, 30/60/90 days, unsourced 14 hours stat) and use the audited 6-week horizon and Invoicing v2 wording.
> 2. **Add Root Error Boundary (`app/error.tsx`):** Ensure any unexpected client-side rendering error produces a graceful recovery screen rather than a blank page crash.
> 3. **Run Demo Flow with Real PayPal Sandbox Payment:** Demonstrate an actual sandbox buyer payment via the hosted URL during video recording rather than relying solely on the simulator button.
