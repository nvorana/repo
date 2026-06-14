import crypto from "node:crypto";
import type { Request, Response } from "express";

const COOKIE = "sc_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Signing secret for session cookies. Set SESSION_SECRET in production so
// sessions survive restarts/redeploys; otherwise an ephemeral one is generated.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function makeToken(userId: string): string {
  const payload = `${userId}.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the userId from a valid, unexpired token, else null. */
function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const mac = token.slice(lastDot + 1);
  const expected = sign(payload);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const [userId, expiry] = payload.split(".");
  if (Number(expiry) < Date.now()) return null;
  return userId || null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function userIdFromRequest(req: Request): string | null {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  return token ? verifyToken(token) : null;
}

function isHttps(req: Request): boolean {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookie(req: Request, res: Response, userId: string): void {
  const attrs = [
    `${COOKIE}=${makeToken(userId)}`,
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
