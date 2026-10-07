import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import { count } from "drizzle-orm";
import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import type { Database as SqlJsDatabase } from "sql.js";
import * as schema from "@/lib/db/schema";
import { invoices } from "@/lib/db/schema";

export type AppDatabase = SQLJsDatabase<typeof schema>;

type DbGlobals = {
  __paypilotSql?: SqlJsDatabase;
  __paypilotDb?: AppDatabase;
  __paypilotDbPath?: string;
  __paypilotInit?: Promise<AppDatabase>;
  __paypilotPersistEnabled?: boolean;
};

const g = globalThis as typeof globalThis & DbGlobals;
const requireFromApp = createRequire(resolve(process.cwd(), "package.json"));

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

function persist(): void {
  const sqlite = g.__paypilotSql;
  const filePath = g.__paypilotDbPath;
  if (!sqlite || !filePath) {
    return;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from(sqlite.export()));
}

function isTransactionSql(sql: string): boolean {
  return /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql.trim());
}

function attachPersist(sqlite: SqlJsDatabase): SqlJsDatabase {
  const originalPrepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = ((sql: string) => {
    const stmt = originalPrepare(sql);
    const originalRun = stmt.run.bind(stmt);
    stmt.run = ((values?: Parameters<typeof stmt.run>[0]) => {
      const result = originalRun(values);
      if (g.__paypilotPersistEnabled !== false && !isTransactionSql(sql)) {
        persist();
      }
      return result;
    }) as typeof stmt.run;
    return stmt;
  }) as typeof sqlite.prepare;
  return sqlite;
}

function loadExistingFile(filePath: string): Uint8Array | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  const bytes = readFileSync(filePath);
  return bytes.length > 0 ? new Uint8Array(bytes) : undefined;
}

function readArrayBuffer(filePath: string): ArrayBuffer {
  const bytes = readFileSync(filePath);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function initDb(): Promise<AppDatabase> {
  if (g.__paypilotDb) {
    return g.__paypilotDb;
  }
  if (!g.__paypilotInit) {
    g.__paypilotInit = (async () => {
      const filePath = sqliteFilePath(getDatabaseUrl());
      g.__paypilotDbPath = filePath;

      const initSqlJs = requireFromApp("sql.js") as typeof import("sql.js");
      const wasmPath = requireFromApp.resolve("sql.js/dist/sql-wasm.wasm");
      const SQL = await initSqlJs({
        wasmBinary: readArrayBuffer(wasmPath),
      });

      mkdirSync(dirname(filePath), { recursive: true });
      const sqlite = attachPersist(new SQL.Database(loadExistingFile(filePath)));
      g.__paypilotSql = sqlite;

      const database = drizzle(sqlite, { schema });
      g.__paypilotPersistEnabled = false;
      migrate(database, { migrationsFolder: resolve(process.cwd(), "drizzle") });
      g.__paypilotPersistEnabled = true;
      persist();
      g.__paypilotDb = database;
      return database;
    })();
  }

  return g.__paypilotInit;
}

export async function getDb(): Promise<AppDatabase> {
  return initDb();
}

export async function pingDb(): Promise<{ invoiceCount: number }> {
  const database = await getDb();
  const row = database.select({ invoiceCount: count() }).from(invoices).get();
  return { invoiceCount: row?.invoiceCount ?? 0 };
}
