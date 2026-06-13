import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export type Role = "rep" | "manager";

const COOKIE = "cc_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const REP_PASSWORD = process.env.REP_PASSWORD ?? "";
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD ?? "";

// Signing secret for session cookies. Set SESSION_SECRET in production so
// sessions survive restarts/redeploys; otherwise we generate an ephemeral one
// (everyone is logged out on each redeploy, which is merely an inconvenience).
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

/** Auth is active only when at least one role password is configured. */
export function authEnabled(): boolean {
  return Boolean(REP_PASSWORD || MANAGER_PASSWORD);
}

function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Returns the role a password unlocks, or null if it matches none. */
export function roleForPassword(password: string): Role | null {
  if (MANAGER_PASSWORD && constantTimeEquals(password, MANAGER_PASSWORD)) return "manager";
  if (REP_PASSWORD && constantTimeEquals(password, REP_PASSWORD)) return "rep";
  return null;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function makeToken(role: Role): string {
  const payload = `${role}.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string): Role | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const mac = token.slice(lastDot + 1);
  if (!constantTimeEquals(mac, sign(payload))) return null;
  const [role, expiry] = payload.split(".");
  if (Number(expiry) < Date.now()) return null;
  return role === "rep" || role === "manager" ? role : null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function roleFromRequest(req: Request): Role | null {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  return token ? verifyToken(token) : null;
}

function isHttps(req: Request): boolean {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookie(req: Request, res: Response, role: Role): void {
  const attrs = [
    `${COOKIE}=${makeToken(role)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  ];
  if (isHttps(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

/** Middleware: require any logged-in role (no-op when auth is disabled). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled() || roleFromRequest(req)) return next();
  res.status(401).json({ error: "Not logged in" });
}

/** Middleware: require the manager role for coaching actions. */
export function requireManager(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled() || roleFromRequest(req) === "manager") return next();
  res.status(403).json({ error: "Only the sales head can do this" });
}
