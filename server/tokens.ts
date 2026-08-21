import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";

/**
 * Read-only API tokens, for machines rather than people.
 *
 * Two sources, checked together:
 *
 *  1. API_READ_TOKENS env var — `name:secret` pairs, comma separated. Good for
 *     a deploy-time credential you never want stored on the volume.
 *  2. A token store on the volume, managed through the API by a manager. Good
 *     for day-to-day: issuing and revoking need no redeploy, which matters
 *     because a credential you cannot revoke quickly is a credential you cannot
 *     really trust.
 *
 * Callers send it as `Authorization: Bearer <secret>`.
 *
 * The store keeps only sha256(secret). The raw secret is returned exactly once,
 * at creation, and is unrecoverable afterwards — so a stolen tokens.json cannot
 * be turned into API access, and a lost token is reissued rather than looked up.
 *
 * These grant READ ONLY. Enforcement lives in index.ts and refuses by HTTP
 * method, so every future write route is covered without anyone remembering to
 * opt it in — a token cannot release a report, flag a finding, upload or delete.
 */

export interface ApiToken {
  /** Human name for the consuming system, e.g. "cortex". Logged, never secret. */
  name: string;
}

/** What a manager sees when listing tokens. Never includes the secret. */
export interface PublicApiToken {
  id: string;
  name: string;
  createdAt: string;
  /** First 6 characters, so a token in a config file can be identified. */
  hint: string;
}

interface StoredToken {
  id: string;
  name: string;
  hash: string;
  hint: string;
  createdAt: string;
}

const MIN_SECRET_LENGTH = 16;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// --- env-configured tokens ---------------------------------------------------

function parseEnv(raw: string | undefined): Map<string, ApiToken> {
  const out = new Map<string, ApiToken>();
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const name = colon > 0 ? trimmed.slice(0, colon).trim() : "unnamed";
    const secret = colon > 0 ? trimmed.slice(colon + 1).trim() : trimmed;
    if (secret.length < MIN_SECRET_LENGTH) {
      console.error(
        `Ignoring API_READ_TOKENS entry "${name}": secret must be at least ${MIN_SECRET_LENGTH} characters.`,
      );
      continue;
    }
    out.set(secret, { name });
  }
  return out;
}

const envTokens = parseEnv(process.env.API_READ_TOKENS);

// --- persisted token store ---------------------------------------------------

export class TokenStore {
  private readonly file: string;
  private tokens: StoredToken[] = [];

  constructor(file: string) {
    this.file = file;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    } catch (err) {
      console.error(`FATAL: cannot create/write token dir "${path.dirname(file)}".`, err);
      throw err;
    }
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        this.tokens = JSON.parse(fs.readFileSync(this.file, "utf8")) as StoredToken[];
      }
    } catch (err) {
      // A corrupt token file must not stop the app booting — it fails CLOSED,
      // with no tokens, rather than open.
      console.error(`Could not read tokens file ${this.file}; starting with none.`, err);
      this.tokens = [];
    }
  }

  /** Atomic, same as the review store: an interrupted write must not truncate. */
  private save(): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.tokens, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* best effort */
      }
      throw err;
    }
  }

  list(): PublicApiToken[] {
    return this.tokens.map(({ id, name, createdAt, hint }) => ({ id, name, createdAt, hint }));
  }

  /** Returns the raw secret — the only time it exists outside the caller. */
  create(name: string): { token: PublicApiToken; secret: string } {
    const clean = name.trim().slice(0, 60) || "unnamed";
    const secret = crypto.randomBytes(24).toString("base64url");
    const entry: StoredToken = {
      id: crypto.randomUUID(),
      name: clean,
      hash: sha256(secret),
      hint: secret.slice(0, 6),
      createdAt: new Date().toISOString(),
    };
    this.tokens.push(entry);
    this.save();
    return {
      token: { id: entry.id, name: entry.name, createdAt: entry.createdAt, hint: entry.hint },
      secret,
    };
  }

  revoke(id: string): boolean {
    const before = this.tokens.length;
    this.tokens = this.tokens.filter((t) => t.id !== id);
    if (this.tokens.length === before) return false;
    this.save();
    return true;
  }

  /** Constant-time match of a presented secret against every stored hash. */
  match(secret: string): ApiToken | null {
    if (!secret) return null;
    const presented = Buffer.from(sha256(secret));
    let found: ApiToken | null = null;
    for (const t of this.tokens) {
      const stored = Buffer.from(t.hash);
      if (presented.length === stored.length && crypto.timingSafeEqual(presented, stored)) {
        found = { name: t.name };
      }
    }
    return found;
  }
}

let store: TokenStore | null = null;

export function initTokenStore(file: string): TokenStore {
  store = new TokenStore(file);
  return store;
}

export function tokensConfigured(): boolean {
  return envTokens.size > 0 || (store?.list().length ?? 0) > 0;
}

function bearerOf(req: Request): string {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/**
 * The consuming system for this request, or null.
 *
 * Compared in constant time: a plain === would leak, through timing, how much
 * of a guessed token was correct.
 */
export function apiTokenClient(req: Request): ApiToken | null {
  const presented = bearerOf(req);
  if (!presented) return null;

  const a = Buffer.from(presented);
  for (const [secret, meta] of envTokens) {
    const b = Buffer.from(secret);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return meta;
  }
  return store?.match(presented) ?? null;
}
