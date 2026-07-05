import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const APPLIED_LESSON_CAP = 20;

export interface Lesson {
  id: string;
  frameworkId: string;
  text: string;
  status: "proposed" | "applied" | "discarded";
  rationale: string;
  sourceReviewId: string;
  sourceFindingPoint: string;
  sourceNote?: string;
  createdAt: string;
  appliedAt?: string;
}

export interface LessonProposal {
  frameworkId: string;
  text: string;
  rationale: string;
  sourceReviewId: string;
  sourceFindingPoint: string;
  sourceNote?: string;
}

/**
 * Coach-curated lessons distilled from rep flags: one JSON file per framework
 * under the data dir. Only "applied" lessons reach the analyzer prompt; a
 * corrupt/missing file reads as empty — analysis must never fail over lessons.
 */
export class LessonStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  propose(p: LessonProposal): Lesson {
    const lesson: Lesson = {
      id: crypto.randomUUID(),
      status: "proposed",
      createdAt: new Date().toISOString(),
      ...p,
    };
    this.write(p.frameworkId, [...this.read(p.frameworkId), lesson]);
    return lesson;
  }

  list(): Lesson[] {
    const all: Lesson[] = [];
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      all.push(...this.readFile(path.join(this.dir, f)));
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  apply(id: string): Lesson {
    return this.update(id, (lesson, siblings) => {
      const applied = siblings.filter((l) => l.status === "applied" && l.id !== id).length;
      if (applied >= APPLIED_LESSON_CAP) {
        throw new Error(
          `This framework already has ${APPLIED_LESSON_CAP} active lessons — remove one first.`,
        );
      }
      return { ...lesson, status: "applied", appliedAt: new Date().toISOString() };
    });
  }

  discard(id: string): Lesson {
    return this.update(id, (lesson) => ({ ...lesson, status: "discarded" }));
  }

  /** The lesson texts a new analysis of this framework should obey. */
  appliedTexts(frameworkId: string): string[] {
    return this.read(frameworkId)
      .filter((l) => l.status === "applied")
      .map((l) => l.text);
  }

  private update(id: string, fn: (lesson: Lesson, siblings: Lesson[]) => Lesson): Lesson {
    for (const f of fs.readdirSync(this.dir).filter((f) => f.endsWith(".json"))) {
      const file = path.join(this.dir, f);
      const lessons = this.readFile(file);
      const idx = lessons.findIndex((l) => l.id === id);
      if (idx === -1) continue;
      const next = fn(lessons[idx], lessons);
      lessons[idx] = next;
      fs.writeFileSync(file, JSON.stringify(lessons, null, 2));
      return next;
    }
    throw new Error(`Unknown lesson: ${id}`);
  }

  private read(frameworkId: string): Lesson[] {
    return this.readFile(this.fileFor(frameworkId));
  }

  private readFile(file: string): Lesson[] {
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, "utf8")) as Lesson[];
    } catch (err) {
      console.error(`Ignoring unreadable lessons file ${file}:`, err);
      return [];
    }
  }

  private write(frameworkId: string, lessons: Lesson[]): void {
    fs.writeFileSync(this.fileFor(frameworkId), JSON.stringify(lessons, null, 2));
  }

  private fileFor(frameworkId: string): string {
    return path.join(this.dir, `${path.basename(frameworkId)}.json`);
  }
}
