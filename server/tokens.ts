import crypto from "node:crypto";
import type { Request } from "express";

/**
 * Read-only API tokens, for machines rather than people.
 *
 * Configured as API_READ_TOKENS, a comma-separated list of `name:secret`:
 *
 *   API_READ_TOKENS=cortex:9f3c…,analytics:7b21…
 *
 * The NAME exists so a pull can be attributed — Cortex is a provenance system,
 * and "which client read this, and when" is exactly the kind of thing it should
 * be able to answer about its own inputs. It also means one consumer can be
 * revoked without disturbing the others: delete its entry, redeploy.
 *
 * Callers send it as a bearer token:
 *
 *   Authorization: Bearer 9f3c…
 *
 * These grant READ ONLY. Enforcement lives in index.ts and refuses by HTTP
 * method, so every future write route is covered without anyone remembering to
 * opt it in — a token cannot release a report, flag a finding, upload or delete.
 */

export interface ApiToken {
  /** Human name for the consuming system, e.g. "cortex". Logged, never secret. */
  name: string;
}

function parse(raw: string | undefined): Map<string, ApiToken> {
  const out = new Map<string, ApiToken>();
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    // A bare secret with no name still works; it is just anonymous in the logs.
    const name = colon > 0 ? trimmed.slice(0, colon).trim() : "unnamed";
    const secret = colon > 0 ? trimmed.slice(colon + 1).trim() : trimmed;
    if (secret.length < 16) {
      console.error(
        `Ignoring API_READ_TOKENS entry "${name}": secret must be at least 16 characters.`,
      );
      continue;
    }
    out.set(secret, { name });
  }
  return out;
}

const tokens = parse(process.env.API_READ_TOKENS);

export function tokensConfigured(): boolean {
  return tokens.size > 0;
}

function bearerOf(req: Request): string {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/**
 * The consuming system for this request, or null.
 *
 * Compared in constant time against every configured secret: a plain === would
 * leak, through timing, how much of a guessed token was correct.
 */
export function apiTokenClient(req: Request): ApiToken | null {
  const presented = bearerOf(req);
  if (!presented || tokens.size === 0) return null;
  const a = Buffer.from(presented);
  let found: ApiToken | null = null;
  for (const [secret, meta] of tokens) {
    const b = Buffer.from(secret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) found = meta;
  }
  return found;
}
