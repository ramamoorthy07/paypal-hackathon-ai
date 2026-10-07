# PayPilot

An AI freelancer payment agent for the PayPal AI Hackathon.

Freelancers describe finished work in chat. PayPilot parses the job, shows a confirmation card, creates a real PayPal sandbox invoice, sends it as a share link, tracks payment, and reminds clients when they are overdue.

**PayPal is the payment rail** (Invoicing REST + webhooks). **AI is the operator** (parse messy requests, draft invoice copy, compose reminders). Neither is decorative.

Today's vertical slice: chat parse → confirm → sandbox invoice share link → webhook/poll PAID → `/invoices` → AG Grid dashboard. Render and Postman come later.
