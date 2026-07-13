import type { LucideIcon } from 'lucide-react'
import { Sparkles, Telescope, DraftingCompass, Feather, Sunrise } from 'lucide-react'
import type { Module, StudioId, Suggestion } from './types'

/* ------------------------------------------------------------------ */
/*  The five rooms                                                     */
/* ------------------------------------------------------------------ */

export interface Studio {
  id: StudioId
  index: number
  name: string
  room: string
  tagline: string
  icon: LucideIcon
  accent: string
  accentSoft: string
  glowA: string
  glowB: string
  companionNote: string
  suggestions: Suggestion[]
}

export const STUDIOS: Studio[] = [
  {
    id: 'idea',
    index: 0,
    name: 'Idea',
    room: 'The Spark Room',
    tagline: 'Give the idea a shape you can hold.',
    icon: Sparkles,
    accent: 'var(--color-ember-400)',
    accentSoft: 'rgba(224, 177, 130, 0.14)',
    glowA: 'rgba(224, 177, 130, 0.13)',
    glowB: 'rgba(123, 121, 238, 0.09)',
    companionNote:
      'This room is for clarity, not perfection. Say the idea out loud in one line — we can sharpen who it serves and what it promises together.',
    suggestions: [
      {
        id: 'idea-narrow',
        label: 'Is my idea too broad?',
        reply:
          'A useful test: could you name one specific person who would pay for this next week? If the answer is "everyone who…", it is still a topic, not a product. Try narrowing on one axis — a specific audience, a specific moment ("their first client", "the week before launch"), or a specific outcome. Narrow ideas feel small but sell large; broad ideas feel large and sell to no one.',
      },
      {
        id: 'idea-oneliner',
        label: 'Help me tighten the one-liner',
        reply:
          'A strong one-liner has three joints: who it is for, what changes for them, and what makes your angle yours. A shape that rarely fails — "I help [a specific person] go from [a felt struggle] to [a concrete outcome], using [your particular lens]." Write four bad versions quickly rather than one careful version slowly; the good line usually appears in the third draft.',
      },
      {
        id: 'idea-worth',
        label: 'How do I know it is worth building?',
        reply:
          'You are looking for three signals before you invest months: people already spend money trying to solve this (courses, tools, coaching), they describe the problem in their own words in public (forums, reviews, communities), and you can reach them without inventing a new channel. Two of three is a green light for a first product — the Research room next door is built to check exactly this.',
      },
    ],
  },
  {
    id: 'research',
    index: 1,
    name: 'Research',
    room: 'The Observatory',
    tagline: 'Listen before you build.',
    icon: Telescope,
    accent: 'var(--color-tide-400)',
    accentSoft: 'rgba(143, 201, 196, 0.13)',
    glowA: 'rgba(143, 201, 196, 0.11)',
    glowB: 'rgba(123, 121, 238, 0.10)',
    companionNote:
      'I have gathered early signals about your audience and the landscape around your idea. Treat these as starting hypotheses — the questions panel tells you which ones to verify with real people.',
    suggestions: [
      {
        id: 'research-talk',
        label: 'How do I talk to potential buyers?',
        reply:
          'Five honest conversations beat five hundred survey responses. Ask about the past, not the future — "tell me about the last time you tried to solve this" reveals truth, while "would you buy this?" invites politeness. Listen for the words they use to describe the pain; those exact phrases become your landing page later. End each call by asking who else you should talk to.',
      },
      {
        id: 'research-competitors',
        label: 'Competitors already exist. Bad sign?',
        reply:
          'The opposite — competitors are proof that money flows through this problem. A market with zero competition usually has zero customers. Your job is not to beat them everywhere; it is to find the one gap they all share. Read their one-star and three-star reviews: that is where buyers tell you, in writing, exactly what to build differently.',
      },
      {
        id: 'research-enough',
        label: 'When is research "enough"?',
        reply:
          'When you can predict what the next person will say before they say it, you have reached saturation — for a first product that often takes only five to eight conversations. Research is a room you pass through, not a place to live. If you can fill in "they struggle with X, they have tried Y, they want Z in their own words", walk to the Blueprint room.',
      },
    ],
  },
  {
    id: 'blueprint',
    index: 2,
    name: 'Blueprint',
    room: 'The Drafting Table',
    tagline: 'Decide the shape before the words.',
    icon: DraftingCompass,
    accent: 'var(--color-iris-400)',
    accentSoft: 'rgba(155, 154, 245, 0.14)',
    glowA: 'rgba(123, 121, 238, 0.13)',
    glowB: 'rgba(143, 201, 196, 0.08)',
    companionNote:
      'Structure is a promise about the journey. I drafted an arc from your research — feel free to reorder, cut, or add. Cutting a chapter here saves you a week of writing later.',
    suggestions: [
      {
        id: 'blueprint-scope',
        label: 'How big should a first product be?',
        reply:
          'Smaller than feels comfortable. The goal of a first product is a finished product — a focused four-chapter guide someone completes beats a ten-module masterpiece you abandon at module six. A good rule: scope it so the first full draft takes two to three weeks of your real, available hours. You can always ship a deeper edition later; you cannot ship momentum you have lost.',
      },
      {
        id: 'blueprint-order',
        label: 'What makes a chapter order good?',
        reply:
          'Order by the reader’s journey, not your knowledge. Start where they are (the struggle they would name themselves), give an early win in chapter one or two so they trust the path, then sequence each chapter so it removes the next obstacle. A quick test: read only your chapter titles aloud — they should sound like a story with a beginning, a turn, and an arrival.',
      },
      {
        id: 'blueprint-price',
        label: 'Help me think about pricing',
        reply:
          'Price against the outcome, not the page count. If your product helps a freelancer win one better client, a $79 guide is trivially cheap. First-time creators almost always underprice out of modesty — pick the number that makes you slightly nervous, then make the promise on the cover strong enough to earn it. You can run a launch discount for early believers instead of a permanently low price.',
      },
    ],
  },
  {
    id: 'writing',
    index: 3,
    name: 'Writing',
    room: 'The Quiet Desk',
    tagline: 'One chapter. One sitting. No noise.',
    icon: Feather,
    accent: 'var(--color-ivory-400)',
    accentSoft: 'rgba(224, 203, 164, 0.13)',
    glowA: 'rgba(224, 203, 164, 0.10)',
    glowB: 'rgba(224, 177, 130, 0.08)',
    companionNote:
      'Everything else is dimmed on purpose. Write badly and fast — I will offer a thread to pull whenever you pause, and we can polish together once the draft exists.',
    suggestions: [
      {
        id: 'writing-stuck',
        label: 'I am staring at a blank page',
        reply:
          'Skip the introduction — it is the hardest part and the last thing you should write. Start in the middle of the chapter with the sentence "Here is the thing nobody tells you about this:" and answer it. You can also talk your way in: explain the chapter to an imaginary friend for two minutes, write down what you just said, and edit that. Draft ugly; editing ugly words is easy, editing a blank page is impossible.',
      },
      {
        id: 'writing-voice',
        label: 'How do I sound like myself?',
        reply:
          'Write the way you explain things to one person you like, not the way books sound. Two mechanical tricks help: use "you" more than "people", and read each section aloud — anywhere you stumble, the sentence is dressed up too formally. Your early customers are buying your particular way of seeing this; sanding off the personality sands off the product.',
      },
      {
        id: 'writing-done',
        label: 'When is a chapter done?',
        reply:
          'A chapter is done when a reader can do the thing it promises, not when every sentence is beautiful. Check three things: the promise in the title is kept, there is one concrete example or story, and the reader knows exactly what to do next. Then stop. Perfection is a form of hiding — done chapters compound, polished fragments do not.',
      },
    ],
  },
  {
    id: 'launch',
    index: 4,
    name: 'Launch',
    room: 'The Send-off',
    tagline: 'Open the doors with confidence.',
    icon: Sunrise,
    accent: 'var(--color-moss-400)',
    accentSoft: 'rgba(163, 208, 176, 0.13)',
    glowA: 'rgba(163, 208, 176, 0.11)',
    glowB: 'rgba(123, 121, 238, 0.09)',
    companionNote:
      'Launching is a series of small, finishable moves — not one terrifying moment. The readiness ring fills as you complete them. I drafted your announcement below so day one is already written.',
    suggestions: [
      {
        id: 'launch-audience',
        label: 'I have no audience. Can I still launch?',
        reply:
          'Yes — your first launch is to people, not to an audience. List twenty humans who know you and would genuinely benefit: past colleagues, community members, the people you interviewed in research. A personal note to twenty right people outperforms a broadcast to two thousand strangers. Your first ten customers are found one at a time; the audience comes after the product, not before.',
      },
      {
        id: 'launch-fear',
        label: 'What if nobody buys?',
        reply:
          'Then you have purchased the cheapest, most valuable market lesson available — and you will feel it for a week, not a year. Protect yourself structurally: launch to a small warm circle first, ask non-buyers one gentle question ("what held you back?"), and treat the answers as your next iteration, not a verdict on you. Every founder you admire has a launch that went quiet. The difference is they launched again.',
      },
      {
        id: 'launch-after',
        label: 'What happens after launch day?',
        reply:
          'Launch is a week, not a day. Day one is your announcement; days two through seven are follow-ups that each add something new — a sample chapter, a buyer’s question answered in public, a behind-the-scenes note, a final "doors closing" reminder for your early price. Then shift rhythm: one useful public post a week, and a short note to every single buyer asking what they hoped it would do for them. That sentence is your next product.',
      },
    ],
  },
]

export const studioById = (id: StudioId): Studio => STUDIOS.find((s) => s.id === id) as Studio

/* ------------------------------------------------------------------ */
/*  Idea room — angles the companion proposes                          */
/* ------------------------------------------------------------------ */

export interface Angle {
  title: string
  body: string
}

export const IDEA_ANGLES: Angle[][] = [
  [
    {
      title: 'The specific person',
      body: 'Aim this at someone in their first year — the person still improvising. Beginners buy maps; experts buy edges. Your credibility with them is that you are three steps ahead, not thirty.',
    },
    {
      title: 'The felt moment',
      body: 'Anchor the product to a moment of pain they would recognize instantly — the night before a deadline, the first client call, the pricing email they rewrite five times. Moments convert; topics inform.',
    },
    {
      title: 'The honest promise',
      body: 'Promise one visible change, not general improvement. "You will send your first proposal this week" beats "level up your freelancing". Small, verifiable promises build the trust a first product needs.',
    },
  ],
  [
    {
      title: 'The contrarian cut',
      body: 'What does everyone in this space repeat that you believe is wrong? A respectful disagreement is the fastest way for a newcomer to be memorable — it gives people a reason to choose you over the established names.',
    },
    {
      title: 'The lived story',
      body: 'You have made the mistakes your reader is about to make. Structure the product around what you wish someone had handed you — lived scar tissue is the one asset no competitor can copy.',
    },
    {
      title: 'The smallest version',
      body: 'Imagine shipping this in two weeks instead of two months. What survives the cut is the actual product; everything else was decoration. Start there and let buyers pull the bigger version out of you.',
    },
  ],
]

/* ------------------------------------------------------------------ */
/*  Research room — signals, landscape, open questions                 */
/* ------------------------------------------------------------------ */

export interface AudienceSignal {
  persona: string
  detail: string
  quote: string
}

export const AUDIENCE_SIGNALS: AudienceSignal[] = [
  {
    persona: 'The side-project starter',
    detail: 'Has evenings and ambition, but no structure. Buys things that promise a finish line, then judges them by whether week one feels doable.',
    quote: '“I don’t need motivation — I need someone to tell me what order to do things in.”',
  },
  {
    persona: 'The quiet expert',
    detail: 'Skilled at the craft, allergic to self-promotion. Will pay for anything that makes selling feel like helping instead of shouting.',
    quote: '“I know I’m good at this. I just freeze when it’s time to put a price on it.”',
  },
  {
    persona: 'The burned browser',
    detail: 'Bought two courses that over-promised. Now reads reviews first and trusts specific, modest claims over transformation language.',
    quote: '“Show me exactly what I’ll be able to do by the end, or I’m out.”',
  },
]

export interface Competitor {
  name: string
  angle: string
  gap: string
}

export const LANDSCAPE: Competitor[] = [
  {
    name: 'The flagship course',
    angle: 'Comprehensive, expensive, well-produced. Sells transformation over twelve modules.',
    gap: 'Overwhelming for beginners — most buyers stall by module three. A finishable product wins here.',
  },
  {
    name: 'The free content firehose',
    angle: 'YouTube channels and newsletters covering everything, loosely and forever.',
    gap: 'Breadth without sequence. People drown in tips; nobody hands them the ordered path.',
  },
  {
    name: 'The premium coach',
    angle: 'High-touch 1:1 guidance at $200+ per hour, trusted but scarce.',
    gap: 'Priced out of reach for first-timers — your product can be the affordable first step toward the same outcome.',
  },
]

export const RESEARCH_QUESTIONS: string[] = [
  'Can I name five real people who feel this problem this month?',
  'What have they already tried, and why did it fall short?',
  'What exact words do they use to describe the struggle?',
  'Would they pay to solve it, or only to complain about it?',
  'Where do these people already gather and listen?',
]

/* ------------------------------------------------------------------ */
/*  Blueprint room — the drafted arc                                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_MODULES: Module[] = [
  {
    id: 'm1',
    title: 'Where you actually are',
    summary: 'Name the real starting point without judgment — and collect the raw material you already have.',
  },
  {
    id: 'm2',
    title: 'The first small win',
    summary: 'A result the reader can achieve this week, so the path earns their trust early.',
  },
  {
    id: 'm3',
    title: 'The core method',
    summary: 'Your particular way of doing this, taught once, clearly, with one worked example.',
  },
  {
    id: 'm4',
    title: 'When it goes wrong',
    summary: 'The three failure points you know from experience, and how to walk out of each.',
  },
  {
    id: 'm5',
    title: 'Making it yours',
    summary: 'How the reader adapts the method to their situation and keeps momentum after the last page.',
  },
]

export const FORMATS = ['Written guide', 'Video course', 'Template kit', 'Email series'] as const
export const SIZES = ['Weekend read', 'Two-week sprint', 'Six-week journey'] as const
export const PRICES = ['$29', '$49', '$79', '$129'] as const

/* ------------------------------------------------------------------ */
/*  Writing room — threads the companion offers                        */
/* ------------------------------------------------------------------ */

export const WRITING_THREADS: string[] = [
  'A short story from your own first attempt would land well here — the version where it went wrong.',
  'This is a good place to address the objection the reader is silently forming right now.',
  'Consider a concrete example with real numbers — abstractions are where readers drift away.',
  'You could close this thought with the one sentence you would say if the reader remembered nothing else.',
  'A gentle transition: name what the reader can now do, then point at the door to the next chapter.',
]

export const CHAPTER_SEED = `The gap between having an idea and holding a finished product is not talent. It is a sequence — and nobody hands you the sequence.

`

/* ------------------------------------------------------------------ */
/*  Launch room — checklist and announcement                           */
/* ------------------------------------------------------------------ */

export interface LaunchItem {
  id: string
  group: 'Story' | 'Page' | 'People'
  label: string
  done: boolean
}

export const LAUNCH_ITEMS: LaunchItem[] = [
  { id: 'l1', group: 'Story', label: 'One-line promise finalized', done: true },
  { id: 'l2', group: 'Story', label: 'Announcement post drafted', done: true },
  { id: 'l3', group: 'Story', label: 'Three follow-up notes for launch week', done: false },
  { id: 'l4', group: 'Page', label: 'Landing page hero written', done: true },
  { id: 'l5', group: 'Page', label: 'Pricing and early-believer discount set', done: false },
  { id: 'l6', group: 'Page', label: 'Checkout tested end to end', done: false },
  { id: 'l7', group: 'People', label: 'Twenty warm people listed by name', done: false },
  { id: 'l8', group: 'People', label: 'Personal notes written (not broadcast)', done: false },
  { id: 'l9', group: 'People', label: 'One community picked for day-one post', done: false },
]

export const ANNOUNCEMENT = `For the past few weeks I have been making something I wish had existed when I started.

It is a short, honest guide for people in their first year — the ordered path I had to piece together the hard way, without the padding or the hype.

It ships this Friday. If this is your year to finally make the thing, I saved the best price for the people reading this now.

I would love for you to be one of the first to have it.`

/* ------------------------------------------------------------------ */
/*  Companion — fallback voice                                         */
/* ------------------------------------------------------------------ */

export const COMPANION_FALLBACKS: Record<StudioId, string> = {
  idea: 'Good question to sit with. Here in the Spark Room, the only job is honesty about who this is for and what changes for them. Say more about the person you picture using this, and I can help you test whether the idea is one product or three.',
  research:
    'Worth investigating rather than guessing. The Observatory works best when every belief becomes a question we can check — tell me what you are assuming about your audience, and I will help you design the two or three conversations that would confirm or break it.',
  blueprint:
    'Let us look at it structurally. Every choice at the Drafting Table is really a trade between depth and finishability — tell me which chapter or decision feels heaviest, and we can either shrink it, split it, or cut it without guilt.',
  writing:
    'Keep the pen moving and think of me as the editor who only speaks when asked. If you tell me what this chapter should let the reader do by the end, I can help you find the shortest honest path to it.',
  launch:
    'A calm launch is a prepared one. Tell me which part feels most exposed — the page, the price, or pressing send — and we will turn it into two or three small moves you can finish today.',
}

export const uid = () => Math.random().toString(36).slice(2, 10)
