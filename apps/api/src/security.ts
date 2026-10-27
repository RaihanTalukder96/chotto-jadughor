import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { config, production } from "./config.js";
import { allPermissions } from "./domain.js";
export const hashToken = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const passwordHash = (s: string) =>
  argon2.hash(s, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
export const cookieName = production ? "__Host-cj_session" : "cj_session";
export const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "lax" as const,
  path: "/",
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export type AuthRequest = Request & {
  auth: {
    user: Awaited<ReturnType<typeof db.user.findUniqueOrThrow>>;
    session: { id: string; csrf: string };
    permissions: string[];
  };
};
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const raw = req.cookies[cookieName];
  if (typeof raw !== "string")
    return next(new HttpError(401, "Please sign in"));
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active)
    return next(new HttpError(401, "Session expired. Please sign in again"));
  const permissions =
    session.user.role === "ADMIN"
      ? allPermissions
      : (
          await db.rolePermission.findMany({
            where: { role: session.user.role },
          })
        ).map((p) => p.permission);
  (req as AuthRequest).auth = { user: session.user, session, permissions };
  next();
}
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const a = (req as AuthRequest).auth;
    if (a.user.mustChangePassword)
      return next(new HttpError(403, "Change your temporary password first"));
    if (!a.permissions.includes(permission))
      return next(new HttpError(403, "You do not have access to this action"));
    next();
  };
}
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.origin !== config.APP_ORIGIN)
    return next(new HttpError(403, "Origin not allowed"));
  next();
}
export function csrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const value = req.headers["x-csrf-token"];
  const expected = (req as AuthRequest).auth.session.csrf;
  if (
    typeof value !== "string" ||
    value.length !== expected.length ||
    !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  )
    return next(new HttpError(403, "Invalid CSRF token"));
  next();
}
export const publicUser = (
  user: AuthRequest["auth"]["user"],
  permissions: string[],
) => ({
  id: user.id,
  username: user.username,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
  permissions,
});
export async function newSession(
  userId: string,
  res: Response,
  expectedPasswordHash: string,
) {
  const raw = token();
  const session = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: userId } });
    if (!current?.active || current.passwordHash !== expectedPasswordHash)
      fail(401, "Invalid username or password");
    return tx.session.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        csrf: token(),
        expiresAt: new Date(Date.now() + config.SESSION_HOURS * 3600000),
      },
    });
  });
  res.cookie(cookieName, raw, {
    ...cookieOptions,
    maxAge: config.SESSION_HOURS * 3600000,
  });
  return session;
}
