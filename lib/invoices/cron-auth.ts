import { getEnv } from "@/lib/env";

export function isCronAuthorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
