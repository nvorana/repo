import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type Role = "rep" | "manager";

export interface User {
  id: string;
  name: string; // display name (first name)
  email: string; // unique login identifier
  role: Role;
  salt: string;
  hash: string;
  createdAt: string;
  avatarExt?: string; // extension of the stored profile photo, if any (e.g. "jpg")
  /** SHA-256 of the outstanding password-reset token. The token itself is only
   *  ever in the reset email — a stolen users.json cannot be used to reset. */
  resetHash?: string;
  /** Epoch ms after which the outstanding reset token stops working. */
  resetExpiresAt?: number;
}

/** User as exposed to the client — never includes the password material. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  hasAvatar: boolean;
}

/** Reset links are short-lived: long enough to walk to your inbox, not much more. */
const RESET_TTL_MS = 60 * 60 * 1000;
/** Raised from 4 — four characters is not a password. */
export const MIN_PASSWORD = 8;

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    hasAvatar: Boolean(u.avatarExt),
  };
}

/**
 * Individual accounts (name + password + role), one JSON file. Passwords are
 * scrypt-hashed with a per-user salt — plaintext is never stored.
 */
export class UserStore {
  private readonly file: string;
  private users: User[] = [];

  constructor(file: string) {
    this.file = file;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    } catch (err) {
      console.error(
        `FATAL: cannot create/write users dir "${path.dirname(file)}". Is the volume mounted at /data?`,
        err,
      );
      throw err;
    }
    if (fs.existsSync(file)) {
      try {
        this.users = JSON.parse(fs.readFileSync(file, "utf8")) as User[];
      } catch (err) {
        // Corrupt accounts file must not block boot — back it up and continue.
        // The env-seed will recreate the manager so you can still log in.
        const backup = `${file}.corrupt-${Date.now()}`;
        console.error(`users.json is corrupt; backing up to ${backup} and starting fresh:`, err);
        try {
          fs.renameSync(file, backup);
        } catch {
          /* ignore */
        }
        this.users = [];
      }
    }
  }

  private save() {
    fs.writeFileSync(this.file, JSON.stringify(this.users, null, 2));
  }

  count(): number {
    return this.users.length;
  }

  hasManager(): boolean {
    return this.users.some((u) => u.role === "manager");
  }

  list(): PublicUser[] {
    return [...this.users]
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
      .map(toPublic);
  }

  getById(id: string): User | null {
    return this.users.find((u) => u.id === id) ?? null;
  }

  getByEmail(email: string): User | null {
    const key = email.trim().toLowerCase();
    // Guard against legacy records created before emails existed.
    return this.users.find((u) => (u.email ?? "").toLowerCase() === key) ?? null;
  }

  verify(email: string, password: string): User | null {
    const u = this.getByEmail(email);
    if (!u) return null;
    const candidate = hashPassword(password, u.salt);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(u.hash, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return u;
  }

  create(input: { name: string; email: string; role: Role; password: string }): User {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new Error("First name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    if (input.password.length < MIN_PASSWORD) {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    if (this.getByEmail(email)) throw new Error(`An account with ${email} already exists`);
    const salt = crypto.randomBytes(16).toString("hex");
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      role: input.role,
      salt,
      hash: hashPassword(input.password, salt),
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    this.save();
    return user;
  }

  setPassword(id: string, password: string): void {
    const u = this.getById(id);
    if (!u) throw new Error("User not found");
    if (password.length < MIN_PASSWORD) {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = hashPassword(password, u.salt);
    // Any outstanding reset link dies the moment the password changes.
    delete u.resetHash;
    delete u.resetExpiresAt;
    this.save();
  }

  /**
   * Issues a single-use password-reset token for an email address, or null if
   * no such account exists. Only the token's SHA-256 is stored; the caller
   * emails the raw token and cannot recover it afterwards.
   */
  createResetToken(email: string): { user: User; token: string } | null {
    const u = this.getByEmail(email);
    if (!u) return null;
    const token = crypto.randomBytes(32).toString("base64url");
    u.resetHash = sha256(token);
    u.resetExpiresAt = Date.now() + RESET_TTL_MS;
    this.save();
    return { user: u, token };
  }

  /**
   * Redeems a reset token and sets the new password in one step, so a valid
   * token can never be spent without actually changing the password. Returns
   * the user on success, null when the token is unknown, expired or reused.
   */
  resetPasswordWithToken(token: string, password: string): User | null {
    if (!token) return null;
    const hash = sha256(token);
    // Compare against every candidate in constant time — the list is tiny.
    let match: User | null = null;
    for (const u of this.users) {
      if (!u.resetHash || u.resetHash.length !== hash.length) continue;
      if (crypto.timingSafeEqual(Buffer.from(u.resetHash), Buffer.from(hash))) match = u;
    }
    if (!match) return null;
    if (!match.resetExpiresAt || match.resetExpiresAt < Date.now()) {
      delete match.resetHash;
      delete match.resetExpiresAt;
      this.save();
      return null;
    }
    // setPassword clears the token, making this single-use.
    this.setPassword(match.id, password);
    return match;
  }

  setAvatarExt(id: string, ext: string): void {
    const u = this.getById(id);
    if (!u) throw new Error("User not found");
    u.avatarExt = ext;
    this.save();
  }

  clearAvatar(id: string): void {
    const u = this.getById(id);
    if (!u || !u.avatarExt) return;
    delete u.avatarExt;
    this.save();
  }

  remove(id: string): void {
    const u = this.getById(id);
    if (!u) return;
    if (u.role === "manager" && this.users.filter((x) => x.role === "manager").length <= 1) {
      throw new Error("Can't remove the last manager account");
    }
    this.users = this.users.filter((x) => x.id !== id);
    this.save();
  }
}
