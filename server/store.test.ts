import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ReviewStore } from "./store.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "store-test-"));
}

afterEach(() => vi.restoreAllMocks());

describe("ReviewStore durability", () => {
  it("leaves no temp files behind after a write", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const job = store.create("call.mp3", { rep: "Edgar" });
    store.update(job.id, { status: "completed" });

    const stray = fs.readdirSync(dir).filter((f) => f.includes(".tmp"));
    expect(stray).toEqual([]);
    expect(store.get(job.id)?.status).toBe("completed");
  });

  it("keeps the previous file intact when a write fails mid-way", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const job = store.create("call.mp3", { client: "Maria" });

    // Simulate the disk giving out during the write.
    const spy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("ENOSPC: no space left on device");
    });
    expect(() => store.update(job.id, { status: "completed" })).toThrow(/ENOSPC/);
    spy.mockRestore();

    // The original record must still parse — this is the regression that
    // produced 33 unreadable files in production.
    const after = store.get(job.id);
    expect(after).not.toBeNull();
    expect(after?.client).toBe("Maria");
    expect(fs.readdirSync(dir).filter((f) => f.includes(".tmp"))).toEqual([]);
  });
});

describe("ReviewStore corrupt-file handling", () => {
  it("skips truncated files in list() without throwing", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const good = store.create("good.mp3");
    fs.writeFileSync(path.join(dir, "broken.json"), "");
    fs.writeFileSync(path.join(dir, "half.json"), '{"id":"x","createdAt"');

    const jobs = store.list();
    expect(jobs.map((j) => j.id)).toEqual([good.id]);
  });

  it("logs one summary line per change, not a trace per bad file per call", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    store.create("good.mp3");
    for (let i = 0; i < 6; i++) fs.writeFileSync(path.join(dir, `bad${i}.json`), "");

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    store.list();
    store.list();
    store.list();

    // Three list() calls over six bad files logged once in total.
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain("6 unreadable review file(s)");
  });

  it("quarantines unreadable files and leaves good ones alone", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const good = store.create("good.mp3");
    fs.writeFileSync(path.join(dir, "broken.json"), "");
    fs.writeFileSync(path.join(dir, "half.json"), "{oops");

    expect(store.quarantineCorrupt()).toBe(2);

    expect(fs.existsSync(path.join(dir, "broken.json"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "corrupt", "broken.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "corrupt", "half.json"))).toBe(true);
    expect(store.get(good.id)?.filename).toBe("good.mp3");
    expect(store.quarantineCorrupt()).toBe(0); // idempotent
  });

  it("does not rescan the quarantine folder as reviews", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    store.create("good.mp3");
    fs.writeFileSync(path.join(dir, "broken.json"), "");
    store.quarantineCorrupt();

    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(store.list()).toHaveLength(1);
    expect(err).not.toHaveBeenCalled();
  });
});

describe("ReviewStore list caching", () => {
  it("serves repeated list() calls without re-reading unchanged files", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    store.create("a.mp3");
    store.list(); // prime

    const read = vi.spyOn(fs, "readFileSync");
    store.list();
    expect(read).not.toHaveBeenCalled();
  });

  it("picks up a file changed on disk", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const job = store.create("a.mp3", { client: "Maria" });
    expect(store.list()[0].client).toBe("Maria");

    store.update(job.id, { client: "A Much Longer Client Name" });
    expect(store.list()[0].client).toBe("A Much Longer Client Name");
  });

  it("drops a deleted review from the list", () => {
    const dir = tmpDir();
    const store = new ReviewStore(dir);
    const job = store.create("a.mp3");
    expect(store.list()).toHaveLength(1);
    store.delete(job.id);
    expect(store.list()).toHaveLength(0);
  });
});
