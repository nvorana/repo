export const meta = {
  name: 'micro-research-idea',
  description: 'Micro-research what is hot & trending, generate content ideas, judge them with a multi-judge panel, and produce one winning idea brief',
  whenToUse: 'When you want a fast, well-researched content idea for Negosyo University: scans what is hot/trending (non-political), drafts candidate angles, scores them with multiple judges, and hands back one winning idea ready to script.',
  phases: [
    { title: 'Research', detail: 'parallel agents scan what is hot & trending from different angles' },
    { title: 'Ideate', detail: 'generate candidate content ideas grounded in the research' },
    { title: 'Judge', detail: 'a panel of judges scores every idea on a distinct lens' },
    { title: 'Synthesize', detail: 'pick the winner and write the idea brief' },
  ],
}

// ---------------------------------------------------------------------------
// Focus / audience. Pass a string (or {focus, audience}) as the workflow's
// `args` to steer it. Defaults target Coach Jon's Negosyo University audience.
// ---------------------------------------------------------------------------
const focus =
  (typeof args === 'string' && args.trim()) ||
  (args && args.focus) ||
  'business, entrepreneurship, financial freedom, AI & the future of work, and self-improvement'

const audience =
  (args && args.audience) ||
  'Filipino employees, BPO workers, teachers, and OFWs who dream of building their own business (Negosyo University audience)'

// How many candidate ideas to generate, and the score needed to "win".
const IDEA_COUNT = 6

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['angle', 'findings'],
  properties: {
    angle: { type: 'string', description: 'The research lens this agent covered' },
    findings: {
      type: 'array',
      description: '3-6 concrete, current, NON-POLITICAL trends/observations',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['trend', 'why_it_matters', 'content_hook'],
        properties: {
          trend: { type: 'string', description: 'What is hot right now (be specific & current)' },
          why_it_matters: { type: 'string', description: 'Why this audience cares about it' },
          content_hook: { type: 'string', description: 'A raw angle this could become for a reel/video' },
          source: { type: 'string', description: 'Where you saw it (publication, platform, or search)' },
        },
      },
    },
  },
}

const IDEAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      minItems: IDEA_COUNT,
      maxItems: IDEA_COUNT,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'hook', 'angle', 'format', 'grounded_in'],
        properties: {
          id: { type: 'string', description: 'short stable id, e.g. "idea-1"' },
          title: { type: 'string', description: 'the big idea in one line' },
          hook: { type: 'string', description: 'the scroll-stopping opening line (Tagalog/Taglish welcome)' },
          angle: { type: 'string', description: 'the core argument / emotional promise' },
          format: { type: 'string', enum: ['P.U.N.C.H. reel', 'S.I.G.A.W. reel', 'YouTube long-form', 'email', 'either'] },
          grounded_in: { type: 'string', description: 'which research trend(s) this rides' },
        },
      },
    },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lens', 'scores'],
  properties: {
    lens: { type: 'string' },
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score', 'reason'],
        properties: {
          id: { type: 'string', description: 'the idea id being scored' },
          score: { type: 'number', description: '1-10 on THIS judge\'s lens only' },
          reason: { type: 'string', description: 'one crisp sentence' },
        },
      },
    },
  },
}

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['winner_id', 'title', 'hook', 'angle', 'format', 'why_it_won', 'outline', 'recommended_skill', 'runner_up'],
  properties: {
    winner_id: { type: 'string' },
    title: { type: 'string' },
    hook: { type: 'string' },
    angle: { type: 'string' },
    format: { type: 'string' },
    why_it_won: { type: 'string', description: 'what the judges liked, in plain language' },
    outline: {
      type: 'array',
      description: '3-6 beat outline for the piece',
      items: { type: 'string' },
    },
    recommended_skill: {
      type: 'string',
      description: 'which Negosyo skill to run next to produce it, e.g. facebook-punch-scriptwriter / sigaw-scriptwriter / youtube-stars-scriptwriter / negosyo-email-writer',
    },
    runner_up: { type: 'string', description: 'one-line note on the strongest alternative idea' },
  },
}

// ---------------------------------------------------------------------------
// Phase 1 — Micro-research: 4 blind angles, run in parallel (a barrier is
// correct here: ideation needs the full trend picture before it starts).
// ---------------------------------------------------------------------------
phase('Research')

const RESEARCH_ANGLES = [
  {
    key: 'news-culture',
    prompt: `You are a Philippine culture & news scout. Using WebSearch, find what is genuinely HOT and TRENDING in the Philippines RIGHT NOW that is NON-POLITICAL — pop culture, viral moments, sports, entertainment, seasonal events, money/cost-of-living talk, tech/AI news Filipinos are reacting to. Focus areas: ${focus}. Audience: ${audience}. For each trend give a concrete content hook a business/self-improvement creator could ride WITHOUT being cringe or forced.`,
  },
  {
    key: 'social-reels',
    prompt: `You are a short-form/social trend scout. Using WebSearch, find trending FORMATS, sounds, memes, and conversation patterns on Facebook Reels / TikTok / YouTube Shorts that Filipino audiences are engaging with right now. Focus areas: ${focus}. Audience: ${audience}. For each, note the format/pattern and a content hook adapting it to entrepreneurship/financial-freedom/self-improvement content.`,
  },
  {
    key: 'audience-pain',
    prompt: `You are an audience-insight researcher. Using WebSearch (forums, Reddit r/Philippines, FB group chatter, comment culture), surface the CURRENT pains, fears, frustrations, and desires being voiced by ${audience}. Focus areas: ${focus}. For each, give a content hook that speaks directly to that felt pain — the kind that makes someone stop scrolling because they feel seen.`,
  },
  {
    key: 'competitor-whitespace',
    prompt: `You are a competitive-content analyst. Using WebSearch, look at what other Filipino business/finance/self-improvement creators and pages are posting about right now, and identify (a) angles that are working and (b) WHITESPACE — angles nobody is covering well. Focus areas: ${focus}. Audience: ${audience}. For each finding give a differentiated content hook.`,
  },
]

const research = (
  await parallel(
    RESEARCH_ANGLES.map((a) => () =>
      agent(a.prompt, { label: `research:${a.key}`, phase: 'Research', schema: RESEARCH_SCHEMA }),
    ),
  )
).filter(Boolean)

const trendDigest = research
  .map(
    (r) =>
      `### ${r.angle}\n` +
      r.findings
        .map(
          (f) =>
            `- TREND: ${f.trend}\n  WHY: ${f.why_it_matters}\n  HOOK: ${f.content_hook}` +
            (f.source ? `\n  SRC: ${f.source}` : ''),
        )
        .join('\n'),
  )
  .join('\n\n')

log(`Research done: ${research.length} angles, ${research.reduce((n, r) => n + r.findings.length, 0)} trends found`)

// ---------------------------------------------------------------------------
// Phase 2 — Ideate: turn the research into candidate big ideas.
// ---------------------------------------------------------------------------
phase('Ideate')

const ideaResult = await agent(
  `You are Coach Jon Oraña's idea strategist for Negosyo University.\n` +
    `Audience: ${audience}\nContent focus: ${focus}\n\n` +
    `Below is fresh micro-research on what is hot & trending. Generate EXACTLY ${IDEA_COUNT} distinct, high-potential content ideas, each grounded in the research (do not invent trends). Vary them: some awareness/shareability (S.I.G.A.W.), some conversion (P.U.N.C.H.). Each hook must be scroll-stopping and can be Tagalog/Taglish.\n\n` +
    `=== MICRO-RESEARCH ===\n${trendDigest}`,
  { label: 'ideate', phase: 'Ideate', schema: IDEAS_SCHEMA },
)

const ideas = ideaResult.ideas
const ideaBlock = ideas
  .map((i) => `[${i.id}] ${i.title}\n  HOOK: ${i.hook}\n  ANGLE: ${i.angle}\n  FORMAT: ${i.format}\n  RIDES: ${i.grounded_in}`)
  .join('\n\n')

log(`Ideated ${ideas.length} candidate ideas`)

// ---------------------------------------------------------------------------
// Phase 3 — Judge panel: each judge scores EVERY idea on its own lens only.
// Parallel barrier so synthesis sees all verdicts together.
// ---------------------------------------------------------------------------
phase('Judge')

const JUDGES = [
  {
    lens: 'Scroll-Stopping Hook',
    prompt: `You are a ruthless hook judge. Score each idea 1-10 ONLY on how hard the HOOK stops the scroll in the first 2 seconds for ${audience}. Reward pattern-interrupts, curiosity gaps, and felt tension; punish generic, corporate, or "it depends" openers.`,
  },
  {
    lens: 'Audience Resonance',
    prompt: `You are an audience-truth judge. Score each idea 1-10 ONLY on how deeply it hits a REAL, current pain/desire of ${audience} — does it make them feel seen? Punish ideas that are clever but emotionally cold, or that talk down to the audience.`,
  },
  {
    lens: 'Shareability / Reach',
    prompt: `You are a virality judge. Score each idea 1-10 ONLY on how likely ${audience} is to SHARE, tag, or comment — the reach potential. Reward identity-affirming, "this is so us", debate-sparking angles. Punish ideas that are useful but private/unshareable.`,
  },
  {
    lens: 'Conversion & On-Brand',
    prompt: `You are a business/brand judge for Negosyo University (Coach Jon Oraña). Score each idea 1-10 ONLY on (a) how naturally it leads toward taking action / Negosyo University's offers and (b) on-brand voice (empowering, no-hype, pro-Filipino-dreamer). Punish off-brand, hype-y, or purely-entertaining-with-no-path ideas.`,
  },
]

const verdicts = (
  await parallel(
    JUDGES.map((j) => () =>
      agent(
        `${j.prompt}\n\nScore ALL ${ideas.length} ideas below. Return a score + one-sentence reason for each id.\n\n=== IDEAS ===\n${ideaBlock}`,
        { label: `judge:${j.lens}`, phase: 'Judge', schema: JUDGE_SCHEMA },
      ),
    ),
  )
).filter(Boolean)

// Aggregate scores across the panel.
const totals = {}
for (const i of ideas) totals[i.id] = { id: i.id, title: i.title, sum: 0, byLens: {} }
for (const v of verdicts) {
  for (const s of v.scores) {
    if (!totals[s.id]) continue
    totals[s.id].sum += s.score
    totals[s.id].byLens[v.lens] = { score: s.score, reason: s.reason }
  }
}
const ranked = Object.values(totals).sort((a, b) => b.sum - a.sum)
const maxPossible = JUDGES.length * 10

const scoreboard = ranked
  .map(
    (t, idx) =>
      `${idx + 1}. [${t.id}] ${t.title} — ${t.sum}/${maxPossible}\n` +
      Object.entries(t.byLens)
        .map(([lens, d]) => `     ${lens}: ${d.score} (${d.reason})`)
        .join('\n'),
  )
  .join('\n')

log(`Judging done. Winner so far: ${ranked[0]?.title} (${ranked[0]?.sum}/${maxPossible})`)

// ---------------------------------------------------------------------------
// Phase 4 — Synthesize the winning idea into a ready-to-script brief.
// ---------------------------------------------------------------------------
phase('Synthesize')

const winner = ideas.find((i) => i.id === ranked[0].id)

const brief = await agent(
  `You are Coach Jon's head strategist. The judge panel has ranked the ideas. Write the final IDEA BRIEF for the WINNER so it is ready to hand to a scriptwriter.\n\n` +
    `Audience: ${audience}\nFocus: ${focus}\n\n` +
    `=== WINNING IDEA ===\n[${winner.id}] ${winner.title}\nHOOK: ${winner.hook}\nANGLE: ${winner.angle}\nFORMAT: ${winner.format}\nRIDES: ${winner.grounded_in}\n\n` +
    `=== PANEL SCOREBOARD ===\n${scoreboard}\n\n` +
    `Sharpen the hook if you can, give a 3-6 beat outline, and recommend which Negosyo skill to run next to actually produce it.`,
  { label: 'synthesize', phase: 'Synthesize', schema: BRIEF_SCHEMA },
)

return {
  focus,
  audience,
  trends_found: research.reduce((n, r) => n + r.findings.length, 0),
  ideas,
  scoreboard: ranked.map((t) => ({ id: t.id, title: t.title, total: t.sum, outOf: maxPossible, byLens: t.byLens })),
  winner: brief,
}
