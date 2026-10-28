# Devpost packaging

## Live

- **URL:** https://paypilot-docker.onrender.com  
- **Unlock:** `/unlock` → code **`paypilot`**  
- **Repo:** https://github.com/ramamoorthy07/paypal-hackathon-ai  

## One-line blurb

PayPilot turns messy freelance chat into PayPal sandbox invoices with human-in-the-loop confirm — AI drafts locally; PayPal is the rail; AG Grid cash/risk is computed in code (parser evals 40/40).

## Built with (sponsors)

- **PayPal** — Agent Toolkit + Invoicing REST, share links, webhooks, remind  
- **AG Grid** — `/dashboard` earnings + client risk  
- **Render** — free Docker (`paypilot-docker`)  
- **Postman** — `postman/PayPilot.postman_collection.json`  

## 3-minute video (record from [DEMO.md](../DEMO.md))

1. Warm: `curl -fsS https://paypilot-docker.onrender.com/api/health/live`  
2. Unlock with `paypilot`  
3. Chat → local draft card → **Confirm & get share link**  
4. `/dashboard` AG Grid + forecast (demo ledger if empty)  
5. Overdue invoice → remind (or Activity simulator **Mark Paid**)  
6. Close on HITL one-liner  

Upload 1080p + the five PNGs in [docs/screenshots](screenshots).

## Screenshots checklist

| File | Shot |
| --- | --- |
| `01-chat.png` | Chat + draft card |
| `02-confirm.png` | Confirm / share link |
| `03-dashboard.png` | AG Grid cash + risk |
| `04-invoice.png` | Invoice detail / QR |
| `05-unlock.png` | `/unlock` gate |
