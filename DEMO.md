# PayPilot — 3-minute demo script

Record at 1080p. Dark OS theme. Use a **Sandbox Business** merchant and a **Sandbox Personal** buyer. Keep `.env.local` off camera.

## 0:00–0:20 — The problem

On screen: homepage chat, empty.

Say: Freelancers get paid late because invoicing is messy chat, then a dashboard, then PayPal. PayPilot is the operator. PayPal is the rail. The model never sends money.

## 0:20–0:50 — Chat to draft

Paste:

> Invoice Acme Studio $120 for a logo refresh. Email buyer@personal.example.com. USD.

Wait for the confirmation card. Point at **local DRAFT** — PayPal has not been called.

Optional INR beat (15 seconds): “Client agreed ₹40,000…” and show the labeled demo rate. Confirm conversion on the card.

## 0:50–1:15 — Confirm and share link

Click **Confirm and send**. Show the PayPal sandbox payer URL. Open it in a second window (or QR on the invoice page). Say: first PayPal contact is this confirm step, not the model.

## 1:15–1:40 — Track payment

Go to `/invoices`. Filter **Sent**. Open the invoice. Click **Refresh PayPal status** (localhost cannot receive webhooks). Optionally pay with the sandbox personal account, then refresh until **PAID**.

## 1:40–2:15 — AG Grid dashboard

Go to `/dashboard`. Click **Overdue**, then **Paid this month**. Click a row to jump to the invoice. Click **Write summary**. The briefing uses local totals only — it does not call PayPal.

## 2:15–2:45 — Overdue reminder

Open an overdue invoice that already has a PayPal id. Click **Send PayPal reminder**. Show the AI subject/note and the two-per-day cap. If you only have the local seed overdue row, say: reminders require a PayPal-sent invoice, same confirm-before-send rule.

## 2:45–3:00 — Close

Back on chat. One line: messy request in, sandbox invoice out, human in the loop, PayPal paid.

## Cut list if short on time

Keep: chat → confirm → share link → dashboard summary. Drop INR and QR.
