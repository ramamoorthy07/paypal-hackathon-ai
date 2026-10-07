import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clients, type ClientRow } from "@/lib/db/schema";

export type NewClient = {
  id: string;
  name: string;
  email: string;
  createdAt?: number;
};

export async function upsertClientByEmail(input: NewClient): Promise<ClientRow> {
  const database = getDb();
  const email = input.email.trim().toLowerCase();
  const existing = database.select().from(clients).where(eq(clients.email, email)).get();
  const now = Date.now();

  if (existing) {
    database
      .update(clients)
      .set({ name: input.name.trim() })
      .where(eq(clients.id, existing.id))
      .run();
    const updated = database.select().from(clients).where(eq(clients.id, existing.id)).get();
    if (!updated) {
      throw new Error("Failed to update client.");
    }
    return updated;
  }

  const row = {
    id: input.id,
    name: input.name.trim(),
    email,
    createdAt: input.createdAt ?? now,
  };
  database.insert(clients).values(row).run();
  return row;
}

export async function getClientById(id: string): Promise<ClientRow | undefined> {
  return getDb().select().from(clients).where(eq(clients.id, id)).get();
}

export async function listClients(): Promise<ClientRow[]> {
  return getDb().select().from(clients).all();
}
