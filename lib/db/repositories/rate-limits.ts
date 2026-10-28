import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * Atomically increments a rate limit key in libSQL database.
 * If key does not exist, inserts with count = delta.
 * If key exists, increments count by delta.
 * Returns the updated count.
 */
export async function atomicIncrementRateLimit(
  key: string,
  expiresAt: number,
  delta = 1,
): Promise<number> {
  const db = await getDb();
  const result = await db.run(sql`
    INSERT INTO rate_limits (key, count, expires_at)
    VALUES (${key}, ${delta}, ${expiresAt})
    ON CONFLICT(key) DO UPDATE SET count = count + ${delta}
    RETURNING count
  `);
  const count = (result.rows?.[0]?.[0] as number | undefined) ?? delta;
  return Number(count);
}

/**
 * Test helper to clear all rate limits from database.
 */
export async function clearRateLimitsTable(): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(rateLimits);
  } catch {
    // ignore
  }
}
