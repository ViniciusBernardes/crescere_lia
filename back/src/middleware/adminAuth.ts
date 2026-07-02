import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readAdminUsername(): string | null {
  return process.env.ADMIN_USERNAME?.trim() || null;
}

function readAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

function sessionSecret(): Buffer {
  const user = readAdminUsername() || "";
  const pass = readAdminPassword() || "";
  return createHmac("sha256", "lia-admin-session")
    .update(`${user}:${pass}`)
    .digest();
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(readAdminUsername() && readAdminPassword());
}

export function validateAdminLogin(username: string, password: string): boolean {
  const expectedUser = readAdminUsername();
  const expectedPass = readAdminPassword();
  if (!expectedUser || !expectedPass) return false;
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

export function createSessionToken(username: string): string {
  const payload = {
    u: username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  if (!safeEqual(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { u: string; exp: number };
    if (!payload.u || payload.exp < Date.now()) return null;
    return payload.u;
  } catch {
    return null;
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({
      error: "admin_not_configured",
      message:
        "Painel admin não configurado. Defina ADMIN_USERNAME e ADMIN_PASSWORD no servidor.",
    });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : (req.headers["x-admin-token"] as string | undefined)?.trim();

  if (!token || !verifySessionToken(token)) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Usuário ou senha inválidos, ou sessão expirada.",
    });
  }

  next();
}
