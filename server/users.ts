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
}

/** User as exposed to the client — never includes the password material. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function toPublic(u: User): PublicUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
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
    if (input.password.length < 4) throw new Error("Password must be at least 4 characters");
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
    if (password.length < 4) throw new Error("Password must be at least 4 characters");
    u.salt = crypto.randomBytes(16).toString("hex");
    u.hash = hashPassword(password, u.salt);
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
