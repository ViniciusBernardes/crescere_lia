import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { decrypt } from "../services/crypto.js";
import { ensureDefaultTenant } from "../services/tenants.js";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const dbPath = path.join(DATA_DIR, "lia.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenant_openai_config (
      tenant_id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateLegacySettings(database);
  ensureDefaultTenant();
}

function migrateLegacySettings(database: Database.Database) {
  const legacy = database
    .prepare("SELECT value FROM settings WHERE key = 'openai_credentials'")
    .get() as { value: string } | undefined;

  if (!legacy) return;

  const tenant = ensureDefaultTenant();
  const exists = database
    .prepare("SELECT tenant_id FROM tenant_openai_config WHERE tenant_id = ?")
    .get(tenant.id);

  if (!exists) {
    try {
      decrypt(legacy.value);
      database
        .prepare(
          `INSERT INTO tenant_openai_config (tenant_id, value, updated_at)
           VALUES (?, ?, datetime('now'))`,
        )
        .run(tenant.id, legacy.value);
      console.log(
        "[db] Credenciais OpenAI migradas para tenant padrão:",
        tenant.slug,
      );
    } catch {
      console.warn("[db] Credenciais legadas ignoradas (chave de criptografia diferente)");
    }
  }

  database.prepare("DELETE FROM settings WHERE key = 'openai_credentials'").run();
}
