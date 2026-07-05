import { useEffect, useState } from "react";
import { applyLesson, discardLesson, listLessons, type Lesson } from "../api.ts";

/** Coach-facing curation of AI lessons distilled from rep flags. */
export function LessonsPanel() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLessons().then(setLessons).catch(() => {});
  }, []);

  const proposed = lessons.filter((l) => l.status === "proposed");
  const applied = lessons.filter((l) => l.status === "applied");
  if (proposed.length === 0 && applied.length === 0) return null;

  async function act(id: string, fn: (id: string) => Promise<Lesson>) {
    setError(null);
    try {
      const updated = await fn(id);
      setLessons((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <section className="print-hide">
      <h2 className="mb-3 text-lg font-semibold">AI lessons</h2>
      {error && <p className="mb-2 text-sm text-error">{error}</p>}
      {proposed.length > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-sm opacity-60">
            Proposed from rep feedback — applied lessons shape every future review.
          </p>
          {proposed.map((l) => (
            <div key={l.id} className="card border-l-4 border-info bg-base-200 p-4">
              <p className="font-medium">{l.text}</p>
              <p className="mt-1 text-sm opacity-70">{l.rationale}</p>
              <p className="mt-1 text-xs opacity-50">
                From: “{l.sourceFindingPoint}”{l.sourceNote ? ` — rep: “${l.sourceNote}”` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primary btn-xs" onClick={() => void act(l.id, applyLesson)}>
                  Apply
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => void act(l.id, discardLesson)}>
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {applied.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm opacity-70">
            Applied lessons ({applied.length}/20)
          </summary>
          <ul className="mt-2 space-y-2">
            {applied.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
                <span>{l.text}</span>
                <button className="btn btn-ghost btn-xs shrink-0" onClick={() => void act(l.id, discardLesson)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
