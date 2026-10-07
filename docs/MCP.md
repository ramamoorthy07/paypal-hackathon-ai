# PayPilot MCP

Streamable HTTP MCP server at `POST|GET|DELETE /api/mcp` using `createMcpHandler` from `@modelcontextprotocol/server`.

## Auth

Send `Authorization: Bearer $MCP_BEARER_TOKEN`.

- Locally, if `MCP_BEARER_TOKEN` is unset, the route is open (same pattern as the demo cookie).
- In production, a bearer token is required.
- This is **not** the demo-access cookie. Chat/confirm/remind stay cookie-gated.

## Tools (read-only)

| Tool | What it returns |
| --- | --- |
| `listOverdue` | Local OVERDUE invoices, integer cents |
| `getCashForecast` | Next 6 UTC weeks of expected cash (computed in code) |
| `getClientRisk` | Client risk scores 0–100, late rates, overdue counts |

There is **no** `proposeInvoice`, confirm, send, or remind tool on MCP. A connected client-agent cannot write PayPal through this endpoint.

## Cursor / Claude example

```json
{
  "mcpServers": {
    "paypilot": {
      "url": "https://paypilot-docker.onrender.com/api/mcp",
      "headers": {
        "Authorization": "Bearer $MCP_BEARER_TOKEN"
      }
    }
  }
}
```

Arithmetic and risk stay in PayPilot code. The client model should cite returned numbers, not invent totals.
