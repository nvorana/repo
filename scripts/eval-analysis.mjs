// Accuracy check for the review analysis. Runs the real analyzer against small
// hand-built transcripts that encode known failure modes, and prints the parts
// of the review that used to be wrong so we can SEE whether a prompt change
// helped — instead of guessing.
//
// Usage (needs an Anthropic key; costs a few cents per fixture):
//   node scripts/eval-analysis.mjs
// Reads ANTHROPIC_API_KEY from the repo .env if present.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Load ANTHROPIC_API_KEY from .env if not already set.
const envPath = path.join(ROOT, ".env");
if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*?)\s*$/);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^(["'])(.*)\1$/, "$2");
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY (or add it to .env) to run the eval.");
  process.exit(1);
}

const core = await import(pathToFileURL(path.join(ROOT, "core/index.ts")).href);
const { CallAnalyzer, computeDeliveryMetrics, frameworkFromMarkdown } = core;

// Build a transcript from [role, text] lines with fabricated but ordered timings.
function build(lines) {
  let t = 0;
  const utterances = lines.map(([role, text]) => {
    const start = t;
    const words = text.split(/\s+/).map((w, i) => ({
      text: w,
      startMs: start + i * 350,
      endMs: start + i * 350 + 300,
      speaker: role === "salesperson" ? "rep" : "client",
    }));
    t = start + text.split(/\s+/).length * 350 + 1200;
    return {
      speaker: role === "salesperson" ? "rep" : "client",
      role,
      text,
      startMs: start,
      endMs: t - 1200,
      words,
    };
  });
  return { utterances, durationMs: t, text: lines.map((l) => l[1]).join(" ") };
}

const framework = frameworkFromMarkdown(
  "accelerator-program",
  "Accelerator Program",
  fs.readFileSync(path.join(ROOT, "server/frameworks/accelerator-program.md"), "utf8"),
);

// FIXTURE: no explicit deadline is agreed — the prospect just wants to think it
// over and consult her spouse. The ONLY concrete day mentioned is "Saturday",
// which the rep uses purely as an illustration of urgency. A correct review must
// NOT report "Saturday" as an actual agreed deadline.
const gladys = build([
  ["salesperson", "So ma'am, ang investment po sa program is P38,000, pero may one-time na P28,000, save kayo ng sampung libo."],
  ["prospect", "Medyo mahal, kailangan ko pang pag-isipan at i-consult muna sa asawa ko."],
  ["salesperson", "Sige po ma'am. Pero para may sense of urgency — kunwari lang ha, kapag na-late kayo mag-decide, like umabot pa ng Saturday, mawawala na yung promo discount. Kaya mas maganda kung agad."],
  ["prospect", "Hmm, sige, pag-iisipan ko muna."],
  ["salesperson", "Salamat po ma'am, abangan ko na lang yung decision niyo."],
]);

console.log(`\n=== FIXTURE: gladys (NO firm deadline agreed; 'Saturday' = illustration only) ===`);
const analyzer = new CallAnalyzer();
const review = await analyzer.analyze(gladys, computeDeliveryMetrics(gladys), framework);

// Print the parts that used to go wrong for a HUMAN to judge. (Auto pass/fail
// by keyword is unreliable — a review can correctly quote "…Saturday…" while
// calling it out as manufactured urgency, which a regex would wrongly flag.)
console.log("\ncallOutcome (should describe the REAL agreed next step, not the illustration):");
console.log("  " + review.callOutcome);
console.log("\nsummary:");
console.log("  " + review.summary);
console.log("\nfindings mentioning a date/deadline (read: is 'Saturday' framed as an");
console.log("example/urgency, or wrongly asserted as the actual deadline?):");
for (const f of [...review.whatWentWrong, ...review.whatWentRight]) {
  if (/deadline|saturday|decide|decision|commit/i.test(`${f.point} ${f.detail} ${f.quote}`)) {
    console.log(`  • [${f.timestamp}] ${f.point}\n      detail: ${f.detail}\n      quote: "${f.quote}"`);
  }
}
console.log("\n(Manual judgment — the real validation is re-running actual calls.)\n");
