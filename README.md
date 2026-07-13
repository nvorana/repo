# Atelier — Your AI Product Studio

A premium, immersive creative workspace for first-time entrepreneurs making their first digital product. Not a dashboard — an AI operating system you step into, where the journey **Idea → Research → Blueprint → Writing → Launch** unfolds as five distinct creative rooms.

## The experience

- **The Welcome** — a single quiet question: what will you make? One sentence is enough to enter the studio.
- **The Spark Room (Idea)** — shape the idea into a one-liner you can hold, with clarity marks and three sharpening angles from the AI.
- **The Observatory (Research)** — audience signals, the competitive landscape framed as *your opening*, and the five beliefs to verify before building.
- **The Drafting Table (Blueprint)** — a reorderable chapter arc, three scope decisions (form, time, price), and the before/after promise in one glance.
- **The Quiet Desk (Writing)** — a distraction-free serif editor. When the pen rests, Muse offers a thread to pull (accept with `Tab`). Work saves as you write.
- **The Send-off (Launch)** — a readiness ring, launch broken into small finishable moves, and a day-one announcement already drafted.

## The companion

**Muse** is present in every room and intrusive in none. Closed, it is a breathing orb in the corner. Open, it is a glass panel that knows which room you are standing in — offering room-specific context, three quiet suggestions, and streamed conversational answers.

## Design language

- Floating glass panels with hairline borders, soft depth, and generous rounding
- Per-room ambient lighting that crossfades as you move between studios, over a grain-textured, vignetted dark stage
- Inter Variable for the interface, Newsreader for display and long-form writing
- A single calm iris accent; each room adds one soft tint (ember, tide, iris, ivory, moss)
- `⌘K` command palette, `⇧F` focus mode, full keyboard navigation, reduced-motion support
- All studio state persists locally — the studio remembers your work between visits

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Framer Motion for room transitions and micro-interactions
- lucide-react icons, @fontsource typefaces

## Running it

```bash
npm install
npm run dev      # local development
npm run build    # type-check + production build
npm run preview  # serve the production build
```
