import type { CallReview } from "../../core/types.ts";

/**
 * Composes a first draft of the coach's note from a finished report.
 *
 * Mike faces an empty textarea on every call. With 370 calls analysed and 6
 * released, the blank page is not a small friction — it is most of the reason
 * the coaching loop never closed. A draft he edits and sends is a different
 * task from a draft he writes.
 *
 * Written to be SENT, not filed: addressed to the rep as "you", short
 * paragraphs, no headings or bullets, nothing to strip out before pasting into
 * Viber or Messenger. It is a starting point — he edits it, and what he saves
 * is what the rep sees.
 *
 * Composed in code rather than by the model: it is assembled from a report the
 * model already wrote, so a second model call would add cost and latency to
 * re-say what is already on the page.
 */

/** Trim a model sentence to something that reads naturally mid-message. */
function tidy(text: string): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : t + ".";
}

/** Quotes in a chat message read better inline and short. */
function shortQuote(quote: string, max = 120): string {
  const q = (quote ?? "").trim().replace(/\s+/g, " ");
  if (!q) return "";
  return q.length <= max ? q : q.slice(0, max - 1).trimEnd() + "…";
}

export function draftCoachNote(review: CallReview, repName?: string): string {
  const paras: string[] = [];
  const who = (repName ?? "").trim().split(/\s+/)[0];

  paras.push(who ? `Hi ${who} — went through your call.` : "Went through your call.");

  // Something real that worked, named specifically. Not a compliment sandwich:
  // one concrete thing they should keep doing, then straight to the work.
  const win = review.whatWentRight?.[0];
  if (win) {
    const q = shortQuote(win.quote);
    paras.push(
      `What worked: ${tidy(win.point)}` +
        (q ? ` You said "${q}" around ${win.timestamp} — keep doing that.` : " Keep doing that."),
    );
  }

  // The main thing to change, from the highest-priority coaching item. The
  // model already writes these as something you could say to the rep.
  const top = [...(review.coaching ?? [])].sort((a, b) => a.priority - b.priority)[0];
  if (top) {
    paras.push(`The main thing to work on: ${tidy(top.title)}`);
    if (top.advice) paras.push(tidy(top.advice));
    if (top.example) paras.push(`Try it like this next time: "${shortQuote(top.example, 220)}"`);
  }

  // One more, only if it adds something the first did not.
  const second = [...(review.coaching ?? [])].sort((a, b) => a.priority - b.priority)[1];
  if (second) paras.push(`One more: ${tidy(second.title)} ${tidy(second.advice)}`.trim());

  // The costliest miss, if it is not already what we asked them to fix.
  const miss = (review.whatWentWrong ?? []).find((f) => f.impact === "high");
  if (miss && (!top || !tidy(top.title).toLowerCase().includes(tidy(miss.point).toLowerCase().slice(0, 20)))) {
    const q = shortQuote(miss.quote);
    paras.push(
      `Also worth noticing: ${tidy(miss.point)}` + (q ? ` (around ${miss.timestamp}: "${q}")` : ""),
    );
  }

  paras.push("Let's go over this on our next 1:1. Anything here you'd push back on, tell me.");

  return paras.filter(Boolean).join("\n\n");
}
