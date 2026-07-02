import mysql from "mysql2/promise";
import { ensureDefaultTenant } from "../services/tenants.js";

let pool: mysql.Pool | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDbConfig(): mysql.PoolOptions {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "laravel",
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  };
}

function dbHelpMessage(): string {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "3306";
  const database = process.env.DB_DATABASE || "laravel";
  return [
    "",
    "MySQL indisponível — a LIA precisa do banco do telemedicina.",
    "",
    "1) Suba o MySQL:",
    "   cd ~/Documentos/telemedicina && docker compose up -d mysql",
    "",
    "2) Rode as migrations (primeira vez):",
    "   cd ~/Documentos/telemedicina",
    "   docker compose up -d mysql redis",
    "   docker compose run --rm back php artisan migrate --force",
    "",
    "3) Confira back/.env:",
    `   DB_HOST=${host}`,
    `   DB_PORT=${port}`,
    `   DB_DATABASE=${database}`,
    "",
    "4) Suba a LIA:",
    "   cd ~/Documentos/crescere_lia && npm run dev",
    "   (ou docker compose up -d na raiz da LIA)",
    "",
    "App: http://localhost:8080  |  Admin: http://localhost:8080/admin",
    "",
  ].join("\n");
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(readDbConfig());
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 8);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const connection = await getPool().getConnection();
      try {
        await connection.ping();
        await ensureDefaultTenant();
        console.log(
          `[db] MySQL conectado (${process.env.DB_DATABASE}@${process.env.DB_HOST || "127.0.0.1"})`,
        );
        return;
      } finally {
        connection.release();
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(
          `[db] MySQL indisponível (tentativa ${attempt}/${maxAttempts})…`,
        );
        await sleep(1500);
      }
    }
  }

  console.error(dbHelpMessage());
  throw lastError;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
