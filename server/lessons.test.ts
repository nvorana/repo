import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LessonStore, APPLIED_LESSON_CAP } from "./lessons.ts";

let dir: string;
let store: LessonStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-"));
  store = new LessonStore(dir);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const proposal = {
  frameworkId: "accelerator-program",
  text: "Do not count value re-statements after the price as caving.",
  rationale: "Rep never lowered the price.",
  sourceReviewId: "r1",
  sourceFindingPoint: "The rep caved after pricing.",
  sourceNote: "I never discounted",
};

describe("LessonStore", () => {
  it("proposes, lists, applies and feeds appliedTexts", () => {
    const lesson = store.propose(proposal);
    expect(lesson.status).toBe("proposed");
    expect(store.appliedTexts("accelerator-program")).toEqual([]);

    store.apply(lesson.id);
    expect(store.list().find((l) => l.id === lesson.id)?.status).toBe("applied");
    expect(store.appliedTexts("accelerator-program")).toEqual([proposal.text]);
    expect(store.appliedTexts("other-framework")).toEqual([]);
  });

  it("discard removes proposed and applied lessons from future prompts", () => {
    const a = store.propose(proposal);
    store.apply(a.id);
    store.discard(a.id);
    expect(store.appliedTexts("accelerator-program")).toEqual([]);
    expect(store.list().find((l) => l.id === a.id)?.status).toBe("discarded");
  });

  it("enforces the applied cap per framework", () => {
    for (let i = 0; i < APPLIED_LESSON_CAP; i++) {
      store.apply(store.propose({ ...proposal, text: `lesson ${i}` }).id);
    }
    const extra = store.propose({ ...proposal, text: "one too many" });
    expect(() => store.apply(extra.id)).toThrow(/20 active lessons/);
  });

  it("persists across instances and survives a corrupt file", () => {
    const a = store.propose(proposal);
    store.apply(a.id);
    const reopened = new LessonStore(dir);
    expect(reopened.appliedTexts("accelerator-program")).toEqual([proposal.text]);

    fs.writeFileSync(path.join(dir, "accelerator-program.json"), "{not json");
    const corrupt = new LessonStore(dir);
    expect(corrupt.appliedTexts("accelerator-program")).toEqual([]);
    expect(corrupt.list()).toEqual([]);
  });

  it("throws on unknown lesson ids", () => {
    expect(() => store.apply("nope")).toThrow(/Unknown lesson/);
    expect(() => store.discard("nope")).toThrow(/Unknown lesson/);
  });
});
