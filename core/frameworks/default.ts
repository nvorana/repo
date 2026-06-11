import type { SalesFramework } from "./types.ts";

/**
 * General-purpose sales call framework used until an organization-specific
 * framework is plugged in. Based on widely accepted one-on-one sales call
 * practice: discovery before pitch, objection resolution, and a concrete
 * close.
 */
export const defaultFramework: SalesFramework = {
  id: "general-v1",
  name: "General Sales Best Practices",
  guidance: `
Evaluate the call against general one-on-one sales best practices:

- The salesperson should open by setting an agenda and earning the right to
  ask questions, not by pitching.
- Discovery should come before solution talk: uncover the prospect's current
  situation, pain, impact of the pain, and desired outcome. Pain should be
  quantified or made vivid where possible.
- The salesperson should listen more than they talk (roughly 40/60), ask
  open-ended questions, and go at least one level deeper on important answers
  instead of accepting surface responses.
- Solution presentation should be tied explicitly to the pains uncovered, not
  a generic feature tour.
- Every objection or concern — stated or implied — should be acknowledged,
  explored (not argued with), isolated, and resolved before moving on.
- Pricing should be delivered confidently, without unprompted discounting,
  hedging, or rushing past the silence that follows.
- The call should end with a specific, time-bound next step that the prospect
  explicitly agrees to — not "I'll send some info over".
`.trim(),
  criteria: [
    {
      id: "opening",
      name: "Opening & Agenda",
      description:
        "Set the frame, built rapport quickly, established purpose and agenda for the call.",
    },
    {
      id: "discovery",
      name: "Discovery & Questioning",
      description:
        "Asked open-ended questions, uncovered real pain and its impact, dug deeper instead of accepting surface answers.",
    },
    {
      id: "listening",
      name: "Listening & Responsiveness",
      description:
        "Let the prospect speak, didn't interrupt, built on what the prospect actually said.",
    },
    {
      id: "presentation",
      name: "Solution Presentation",
      description:
        "Tied the solution directly to uncovered pains; concise, relevant, no feature dumping.",
    },
    {
      id: "objection-handling",
      name: "Objection Handling",
      description:
        "Surfaced, acknowledged, explored and resolved objections — including unspoken hesitations.",
    },
    {
      id: "delivery",
      name: "Tonality & Delivery",
      description:
        "Confident, well-paced delivery; effective use of pauses; minimal filler and hedging.",
    },
    {
      id: "closing",
      name: "Closing & Next Steps",
      description:
        "Asked for a concrete commitment and secured a specific, time-bound next step.",
    },
  ],
};
