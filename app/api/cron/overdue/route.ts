import { NextResponse } from "next/server";
import { handleOverdueCron } from "@/lib/invoices/cron-http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  return handleOverdueCron(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleOverdueCron(request);
}
