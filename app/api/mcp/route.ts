import { NextResponse } from "next/server";
import { denyIfAbusive } from "@/lib/access/abuse";
import { isMcpAuthorized } from "@/lib/access/mcp-bearer";
import { createPaypilotMcpHandler } from "@/lib/mcp/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const mcp = createPaypilotMcpHandler();

async function handle(request: Request): Promise<Response> {
  if (!isMcpAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "MCP bearer token required. Set Authorization: Bearer $MCP_BEARER_TOKEN." },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }
  const denied = await denyIfAbusive(request, { requireAccess: false });
  if (denied) {
    return denied;
  }
  return mcp.fetch(request);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
