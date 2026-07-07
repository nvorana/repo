import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SupportStore } from "./support.ts";

let dir: string;
let store: SupportStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "support-"));
  store = new SupportStore(dir);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const base = {
  userId: "u1",
  userName: "Ana",
  page: "/",
  userAgent: "test",
  messages: [{ role: "user" as const, content: "help" }],
  aiSummary: "Blank page",
};

describe("SupportStore", () => {
  it("creates open tickets and lists newest-first", () => {
    const a = store.create(base);
    expect(a.status).toBe("open");
    const b = store.create({ ...base, aiSummary: "Second" });
    const ids = store.list().map((t) => t.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it("appends messages to an existing ticket", () => {
    const a = store.create(base);
    const updated = store.append(a.id, [{ role: "user", content: "still broken" }]);
    expect(updated.messages).toHaveLength(2);
    expect(store.get(a.id)?.messages).toHaveLength(2);
  });

  it("resolves a ticket", () => {
    const a = store.create(base);
    const r = store.resolve(a.id);
    expect(r.status).toBe("resolved");
    expect(r.resolvedAt).toBeTruthy();
  });

  it("throws on unknown id and survives a corrupt file", () => {
    expect(() => store.resolve("nope")).toThrow(/Unknown ticket/);
    fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
    expect(store.list().every((t) => t.id !== "bad")).toBe(true);
  });
});
