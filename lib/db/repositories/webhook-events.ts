import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { webhookEvents, type WebhookEventRow } from "@/lib/db/schema";

export async function getWebhookEvent(eventId: string): Promise<WebhookEventRow | undefined> {
  return getDb().select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId)).get();
}

/** Returns true if this event id was newly recorded. */
export async function recordWebhookEvent(eventId: string, type: string): Promise<boolean> {
  const existing = await getWebhookEvent(eventId);
  if (existing) {
    return false;
  }

  try {
    getDb()
      .insert(webhookEvents)
      .values({
        eventId,
        type,
        processedAt: Date.now(),
      })
      .run();
    return true;
  } catch {
    const again = await getWebhookEvent(eventId);
    if (again) {
      return false;
    }
    throw new Error(`Failed to record webhook event ${eventId}.`);
  }
}
