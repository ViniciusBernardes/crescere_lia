import mysql from "mysql2/promise";
import { ensureDefaultTenant } from "../services/tenants.js";

let pool: mysql.Pool | null = null;

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

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(readDbConfig());
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const connection = await getPool().getConnection();
  try {
    await connection.ping();
    await ensureDefaultTenant();
    console.log(
      `[db] MySQL conectado (${process.env.DB_DATABASE}@${process.env.DB_HOST || "127.0.0.1"})`,
    );
  } finally {
    connection.release();
  }
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
