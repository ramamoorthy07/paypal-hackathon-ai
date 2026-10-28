# Spikes

Exploratory work kept as hackathon evidence (not required to run the app).

| Artifact | Purpose |
| --- | --- |
| [CLIENT_AGENT.md](./CLIENT_AGENT.md) | Client-agent / record-payment spike findings |
| `npm run spike:tools` | List PayPal Agent Toolkit tool names (`scripts/spike/list-toolkit-tools.ts`) |
| `npm run spike:client-agent` | Live sandbox spike (`scripts/spike/client-agent.ts`); may overwrite `CLIENT_AGENT.md` |

Recommendation from the spike: do not ship merchant `record_payment` as “client paid.”
