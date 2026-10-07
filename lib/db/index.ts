import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { count } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import { invoices } from "@/lib/db/schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let db: AppDatabase | undefined;
let migrated = false;

export function sqliteFilePath(databaseUrl: string): string {
  let path = databaseUrl;
  if (path.startsWith("file:")) {
    path = path.slice("file:".length);
    if (path.startsWith("///")) {
      path = path.slice(2);
    } else if (path.startsWith("//")) {
      path = path.slice(2);
    }
  }

  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

export function getDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "file:./data/paypilot.db";
}

export function getDb(): AppDatabase {
  if (!db) {
    const filePath = sqliteFilePath(getDatabaseUrl());
    mkdirSync(dirname(filePath), { recursive: true });
    const client = new Database(filePath);
    client.pragma("journal_mode = WAL");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
  }

  if (!migrated) {
    migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
    migrated = true;
  }

  return db;
}

export function pingDb(): { invoiceCount: number } {
  const database = getDb();
  const row = database.select({ invoiceCount: count() }).from(invoices).get();
  return { invoiceCount: row?.invoiceCount ?? 0 };
}
