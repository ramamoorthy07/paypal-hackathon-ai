import { describe, expect, it } from "vitest";
import { isMcpAuthorized } from "@/lib/access/mcp-bearer";
import { isDemoProtectedPath } from "@/lib/access/demo-code";

function request(auth?: string): Request {
  const headers = new Headers();
  if (auth) {
    headers.set("authorization", auth);
  }
  return new Request("http://localhost/api/mcp", { method: "POST", headers });
}

describe("MCP bearer", () => {
  it("is not demo-cookie gated", () => {
    expect(isDemoProtectedPath("/api/mcp")).toBe(false);
  });

  it("allows local requests when no token is configured", () => {
    const previous = process.env.MCP_BEARER_TOKEN;
    delete process.env.MCP_BEARER_TOKEN;
    expect(isMcpAuthorized(request())).toBe(true);
    if (previous === undefined) {
      delete process.env.MCP_BEARER_TOKEN;
    } else {
      process.env.MCP_BEARER_TOKEN = previous;
    }
  });

  it("requires a matching bearer when configured", () => {
    const previous = process.env.MCP_BEARER_TOKEN;
    process.env.MCP_BEARER_TOKEN = "mcp-secret";
    expect(isMcpAuthorized(request())).toBe(false);
    expect(isMcpAuthorized(request("Bearer wrong"))).toBe(false);
    expect(isMcpAuthorized(request("Bearer mcp-secret"))).toBe(true);
    if (previous === undefined) {
      delete process.env.MCP_BEARER_TOKEN;
    } else {
      process.env.MCP_BEARER_TOKEN = previous;
    }
  });
});
