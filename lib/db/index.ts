import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/lib/db/schema";
import { invoices } from "@/lib/db/schema";

export type AppDatabase = LibSQLDatabase<typeof schema>;

export type DbStorage = "file" | "turso";

export type DbPing = {
  invoiceCount: number;
  demoInvoiceCount: number;
  driver: "libsql";
  storage: DbStorage;
};

type DbGlobals = {
  __paypilotClient?: Client;
  __paypilotDb?: AppDatabase;
  __paypilotInit?: Promise<AppDatabase>;
};

const g = globalThis as typeof globalThis & DbGlobals;

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

  return isAbsolute(path) ? path : resolve(/* turbopackIgnore: true */ process.cwd(), path);
}

export function getDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "file:./data/paypilot.db";
}

export function getDatabaseAuthToken(): string | undefined {
  const token = process.env.DATABASE_AUTH_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

export function dbStorageForUrl(databaseUrl: string): DbStorage {
  return databaseUrl.startsWith("file:") || databaseUrl === ":memory:" ? "file" : "turso";
}

function isRemoteUrl(databaseUrl: string): boolean {
  return /^(libsql|https|wss):\/\//i.test(databaseUrl);
}

function createLibsqlClient(): Client {
  const url = getDatabaseUrl();
  const authToken = getDatabaseAuthToken();

  if (url.startsWith("file:")) {
    const filePath = sqliteFilePath(url);
    mkdirSync(dirname(filePath), { recursive: true });
    return createClient({ url: `file:${filePath}` });
  }

  if (url === ":memory:") {
    return createClient({ url: ":memory:" });
  }

  if (isRemoteUrl(url) && !authToken) {
    throw new Error("DATABASE_AUTH_TOKEN is required for a remote libSQL / Turso URL.");
  }

  return createClient({ url, authToken });
}

export async function initDb(): Promise<AppDatabase> {
  if (g.__paypilotDb) {
    return g.__paypilotDb;
  }
  if (!g.__paypilotInit) {
    g.__paypilotInit = (async () => {
      const client = createLibsqlClient();
      g.__paypilotClient = client;
      const database = drizzle(client, { schema });
      await migrate(database, { migrationsFolder: resolve(process.cwd(), "drizzle") });
      g.__paypilotDb = database;
      return database;
    })();
  }

  return g.__paypilotInit;
}

export async function getDb(): Promise<AppDatabase> {
  return initDb();
}

export async function pingDb(): Promise<DbPing> {
  const database = await getDb();
  const total = await database.select({ invoiceCount: count() }).from(invoices).get();
  const demo = await database
    .select({ invoiceCount: count() })
    .from(invoices)
    .where(eq(invoices.isDemo, true))
    .get();

  return {
    invoiceCount: total?.invoiceCount ?? 0,
    demoInvoiceCount: demo?.invoiceCount ?? 0,
    driver: "libsql",
    storage: dbStorageForUrl(getDatabaseUrl()),
  };
}

/** Test-only: drop the cached client so the next initDb uses a fresh URL. */
export async function resetDbForTests(): Promise<void> {
  g.__paypilotDb = undefined;
  g.__paypilotInit = undefined;
  const client = g.__paypilotClient;
  g.__paypilotClient = undefined;
  if (client) {
    client.close();
  }
}
