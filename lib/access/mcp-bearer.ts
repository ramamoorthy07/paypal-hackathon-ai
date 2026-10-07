import { timingSafeEqualString } from "@/lib/access/demo-code";

export function getMcpBearerToken(): string | undefined {
  const value = process.env.MCP_BEARER_TOKEN?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function mcpBearerFromRequest(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header) {
    return undefined;
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : undefined;
}

export function isMcpAuthorized(request: Request): boolean {
  const expected = getMcpBearerToken();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const provided = mcpBearerFromRequest(request);
  if (!provided) {
    return false;
  }
  return timingSafeEqualString(provided, expected);
}
