import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clients, type ClientRow } from "@/lib/db/schema";

export type NewClient = {
  id: string;
  name: string;
  email: string;
  isDemo?: boolean;
  createdAt?: number;
};

export async function upsertClientByEmail(input: NewClient): Promise<ClientRow> {
  const database = await getDb();
  const email = input.email.trim().toLowerCase();
  const existing = await database.select().from(clients).where(eq(clients.email, email)).get();
  const now = Date.now();

  if (existing) {
    await database
      .update(clients)
      .set({
        name: input.name.trim(),
        ...(input.isDemo === undefined ? {} : { isDemo: input.isDemo }),
      })
      .where(eq(clients.id, existing.id))
      .run();
    const updated = await database.select().from(clients).where(eq(clients.id, existing.id)).get();
    if (!updated) {
      throw new Error("Failed to update client.");
    }
    return updated;
  }

  const row = {
    id: input.id,
    name: input.name.trim(),
    email,
    isDemo: input.isDemo ?? false,
    createdAt: input.createdAt ?? now,
  };
  await database.insert(clients).values(row).run();
  return row;
}

export async function getClientById(id: string): Promise<ClientRow | undefined> {
  const database = await getDb();
  return database.select().from(clients).where(eq(clients.id, id)).get();
}

export async function listClients(): Promise<ClientRow[]> {
  const database = await getDb();
  return database.select().from(clients).all();
}
