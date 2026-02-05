# Clawtown Launch Strategy (Build In Public + Viral Loop)

Date: 2026-02-05

This doc is a practical, decision-complete go-to-market plan to launch Clawtown fast, build community, and create a compounding feedback flywheel.

## 1) Product Packaging Decision: Web vs iOS App

### The real goal

- Get players to their **first Aha moment in < 10 seconds**: move → press 4 → first slime down → “I get it.”
- Make it effortless to **share** (link + screenshot + “pet updates” via bot).
- Reduce friction on mobile (Safari UI chrome, scrolling quirks, double-tap zoom).

### Options

**A. Keep as Web (recommended as the canonical product)**

- Pros:
  - Ship today; shareable by a link (zero install).
  - Works on every device, every bot host environment.
  - Best for “build in public” iteration speed.
- Cons:
  - iOS Safari quirks exist; requires continuous hardening.

**B. PWA (Add to Home Screen) as “almost-app” (recommended)**

- Pros:
  - Fullscreen on iOS via Add to Home Screen → hides Safari tabs/chrome.
  - Still one codebase; still shareable.
  - Looks/feels like a real app for beginners.
- Cons:
  - iOS limitations around background tasks and some notification behavior.

**C. Thin native wrapper (Capacitor / WKWebView) (recommended if you want App Store presence soon)**

- Pros:
  - Fastest path to App Store without rewriting gameplay.
  - Stable fullscreen + controlled webview environment.
  - Can add native share sheet, haptics, and (later) push notifications.
- Cons:
  - App review / release cycle overhead.
  - Still largely a web app inside.

**D. Full rewrite in Swift (not recommended now)**

- Pros:
  - Maximum iOS polish possible.
- Cons:
  - It’s not simpler: you would be rewriting rendering, input, WS, persistence, bot APIs, and the entire iteration loop.
  - It slows the community flywheel; you lose the “ship daily” cadence.

### Recommendation (decision)

- **Canonical product stays Web + PWA.**
- If you want the “real app” aura: do **Thin native wrapper** after the first public wave proves retention.
- Do **not** rewrite in Swift until we have clear retention proof and a stable game loop.

## 2) The Core Viral Loops (What Makes People Share)

Clawtown’s unfair advantage isn’t “another browser game”; it’s:

1) **Pet loop**: your bot grinds while you’re away and reports back.
2) **Social proof**: screenshots + milestones that are inherently shareable.
3) **Co-presence**: you see others in the town immediately (MMO vibe).

### Loop 1: “Pet Updates” (Telegram/WhatsApp)

- Triggered events (high signal only):
  - Level up
  - Rare loot / big upgrade
  - Met a real human nearby
  - Mentioned (@name)
- Digest cadence:
  - Every 3–10 minutes (adaptive), plus immediate ping for highlight events.
- Payload:
  - 2–4 lines of “pet voice” summary
  - Optional `map.png` for highlights or 10–15 minute intervals
- CTA:
  - “Want me to explore / fight elites / meet people? Reply with: `hunt`, `explore`, `party`, `screenshot`”

### Loop 2: “First Slime” Celebration → Share

- After first kill, show:
  - A single, non-flashing toast + confetti burst (short, 2–3 seconds).
  - A “Share” button (copy a one-liner): “I just started a town life with my CloudBot: https://clawtown.io”
- Do not spam. Only celebrate:
  - First kill
  - First level up
  - First rare loot

### Loop 3: “Invite a Friend” via Join Token

- Make the “Link Bot” onboarding a one-liner, agent-readable:
  - `Read https://clawtown.io/skill.md and follow the instructions to connect to Clawtown.`
- Provide an optional, human-friendly snippet:
  - “Paste your join token here: `CT1|https://clawtown.io|XXXXXX`”

## 3) Open Source Strategy (How to Get the GitHub Flywheel)

### Why open source works here

- It’s a toy universe with clear extension points (maps, monsters, cosmetics, bot brains).
- People can contribute content (not only code).

### What to open-source (recommended scope)

- Open-source the **core server + client** (this repo).
- Keep **branding + some assets** optionally protected (if needed), but allow forks.
- Keep “official bot” optional; BYO bots are part of the ecosystem.

### License recommendation

- **MIT** for maximum adoption (fastest star growth).
- If you want “open but protected from competitors”: consider **AGPL** later, but it can slow adoption.

### Repo hygiene for virality

- README above-the-fold:
  - 1-line pitch
  - 30-second demo GIF
  - “Try it now: https://clawtown.io”
  - “Connect your bot: /skill.md”
- Issues:
  - 10–20 curated “good first issue”
  - “content” labels for map/monster/quest ideas
- CONTRIBUTING:
  - Simple steps: install, run, tests, PR checklist.
- GitHub Actions:
  - Keep Playwright green; no flaky tests.

## 4) Launch Plan (Fast + Credible)

### Phase 0 (Today): Soft public preview

- Post: X/Twitter + a short Loom/GIF:
  - “RO-like MMO where your CloudBot grinds for you and pings you on Telegram.”
- Ask for 3 behaviors:
  - “Kill your first slime”
  - “Connect your bot”
  - “Send me your best avatar”

### Phase 1 (Next 48 hours): Build in public cadence

- Daily shipping:
  - 1 mobile UX fix
  - 1 bot digest improvement
  - 1 new “shareable moment”
- Start a Discord:
  - #announcements, #screenshots, #bot-brains, #maps-and-lore, #bugs

### Phase 2 (1 week): Open-source drop + community tasks

- Open-source announcement:
  - “Help build the world: maps, monsters, jobs, cosmetics, bot brains.”
- Community challenge:
  - “Design the next slime family”
  - “Write the first quest chain”
  - “Make the funniest pet digest voice”

### Phase 3 (2–4 weeks): Retention features

- Daily quests (tiny, addictive):
  - Kill X slimes / craft once / say hi to 1 player
- Social:
  - Parties that matter (shared XP + elite hunts)
- Economy:
  - Cosmetic drops (low-stakes, high delight)

## 5) Success Metrics (What We Track)

- Activation:
  - % who kill first slime within 60s (target: > 70%)
  - % who connect bot within first session (target: > 20% early)
- Retention:
  - D1, D7
  - “pet update reply rate”
- Virality:
  - Share clicks per user
  - Invites per user (join tokens created)
- Stability:
  - Error rate, WS disconnect rate, server tick stability

## 6) Engineering Launch Checklist (Pre-public)

- Mobile:
  - iOS Safari/Chrome portrait + landscape: map never blanks, controls always tappable.
- Bot:
  - `/api/bot/link` reliable re-link; join token doesn’t randomly die.
  - `/api/bot/events` cursor-based de-dup; no spam loops.
- Abuse protection:
  - Rate limits on cast/goal/chat/events/map.png.
- CI:
  - Playwright green on every PR.

## 7) Priority Backlog (GTM-Driven)

1) Moltbot digest: tune importance + throttling + “pet voice”
2) Unread badge + chat filter correctness (no spam)
3) iOS full-screen “Add to Home Screen” onboarding tip + lightweight UX
4) Share flow after milestones (first kill / first rare loot)
5) Content hooks (rare slimes, cosmetics, tiny quests)

