# Workflows

Multi-agent Claude Code workflows for this project.

## `micro-research-idea`

Micro-researches what's **hot & trending** (non-political), generates candidate
content ideas, scores them with a **panel of judges**, and hands back **one
winning idea brief** ready to script. Runs ~10 agents across 4 phases and takes
roughly 10–15 minutes.

**Phases**

1. **Research** — 4 parallel scouts (news/culture, social/reels, audience pain,
   competitor whitespace) find what's trending right now.
2. **Ideate** — turns the research into 6 candidate ideas (no invented trends).
3. **Judge** — 4 judges each score every idea on ONE lens: Scroll-Stopping Hook,
   Audience Resonance, Shareability/Reach, Conversion & On-Brand.
4. **Synthesize** — picks the highest total score and writes the idea brief
   (sharpened hook, outline, and which Negosyo skill to run next).

**How to run it** (ask Claude Code — workflows are opt-in, so nothing runs on its
own):

- "Run the `micro-research-idea` workflow"
- Steer it with a focus/audience, e.g. "run micro-research-idea focused on OFW
  savings" — the focus is passed in as the workflow's `args`.

**Output** — a JSON object with the trends found, all candidate ideas, the full
judge scoreboard, and the winning idea brief.
