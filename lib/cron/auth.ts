import { timingSafeEqualString } from "@/lib/access/demo-code";
import { getEnv } from "@/lib/core/env";

export function isCronAuthorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  if (!header) {
    return false;
  }
  return timingSafeEqualString(header, `Bearer ${secret}`);
}
