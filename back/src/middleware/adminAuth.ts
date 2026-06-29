import type { NextFunction, Request, Response } from "express";

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return res.status(503).json({
      error: "admin_not_configured",
      message:
        "Painel admin não configurado. Defina ADMIN_TOKEN no servidor.",
    });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : (req.headers["x-admin-token"] as string | undefined)?.trim();

  if (!token || token !== expected) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Token de administrador inválido.",
    });
  }

  next();
}
