import type { FrameworkCriterion, SalesFramework } from "./types.ts";
import { defaultFramework } from "./default.ts";

/**
 * Builds a SalesFramework from a plain markdown document — the easiest way to
 * plug in an organization's own methodology: drop the doc in
 * `server/frameworks/<name>.md` (or call this directly) and every review
 * follows it.
 *
 * Optional criteria extraction: a section headed `## Scorecard` (or
 * `## Criteria`) with bullet items of the form `- **Name**: description`
 * becomes the scorecard. Without one, the default criteria are kept and the
 * document only steers the narrative review.
 */
export function frameworkFromMarkdown(
  id: string,
  name: string,
  markdown: string,
): SalesFramework {
  return {
    id,
    name,
    guidance: markdown.trim(),
    criteria: extractCriteria(markdown) ?? defaultFramework.criteria,
  };
}

function extractCriteria(markdown: string): FrameworkCriterion[] | null {
  const section = /^##\s+(?:scorecard|criteria)\s*$/im;
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => section.test(l));
  if (start === -1) return null;

  const criteria: FrameworkCriterion[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break; // next section
    const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[:—-]\s*(.+)$/);
    if (m) {
      criteria.push({
        id: m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name: m[1].trim(),
        description: m[2].trim(),
      });
    }
  }
  return criteria.length > 0 ? criteria : null;
}
