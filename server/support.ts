import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SupportMessage } from "../core/index.ts";

export interface SupportTicket {
  id: string;
  userId?: string;
  userName?: string;
  page: string;
  userAgent: string;
  messages: SupportMessage[];
  aiSummary: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export interface NewTicket {
  userId?: string;
  userName?: string;
  page: string;
  userAgent: string;
  messages: SupportMessage[];
  aiSummary: string;
}

/**
 * One JSON file per support ticket under the data dir, mirroring ReviewStore.
 * A corrupt/unreadable file is skipped, never fatal.
 */
export class SupportStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  create(t: NewTicket): SupportTicket {
    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      status: "open",
      createdAt: new Date().toISOString(),
      ...t,
    };
    this.write(ticket);
    return ticket;
  }

  append(id: string, messages: SupportMessage[]): SupportTicket {
    const t = this.get(id);
    if (!t) throw new Error(`Unknown ticket: ${id}`);
    const next = { ...t, messages: [...t.messages, ...messages] };
    this.write(next);
    return next;
  }

  resolve(id: string): SupportTicket {
    const t = this.get(id);
    if (!t) throw new Error(`Unknown ticket: ${id}`);
    const next: SupportTicket = { ...t, status: "resolved", resolvedAt: new Date().toISOString() };
    this.write(next);
    return next;
  }

  get(id: string): SupportTicket | null {
    const file = this.fileFor(id);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as SupportTicket;
    } catch (err) {
      console.error(`Skipping unreadable ticket ${file}:`, err);
      return null;
    }
  }

  list(): SupportTicket[] {
    const out: SupportTicket[] = [];
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      try {
        out.push(JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as SupportTicket);
      } catch (err) {
        console.error(`Skipping unreadable ticket ${f}:`, err);
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private fileFor(id: string): string {
    return path.join(this.dir, `${path.basename(id)}.json`);
  }

  private write(t: SupportTicket): void {
    fs.writeFileSync(this.fileFor(t.id), JSON.stringify(t, null, 2));
  }
}
