# Clawtown 48-Hour Launch Plan (Viral-first, Open-core)

Date: 2026-02-05

This is a practical plan to ship in ~2 days, get maximum attention, and create a compounding loop (share → invite → contribute).

## 0) Non‑negotiables (must be true before public)

- Mobile (iOS Safari + Android Chrome): map never blanks; controls always tappable in portrait + landscape.
- Aha path < 10s: open link → move → kill 1 slime → “Share”.
- Invite path is obvious: “Invite a friend” is a first‑class UI affordance.
- Bot platform message is real: join token → any agent can connect via HTTP spec (`/skill.md`).

## 1) Packaging decision (open-core that can monetize later)

**Recommendation**

- **MIT for code** (fastest adoption + forks + stars).
- Protect brand via `TRADEMARK.md`.
- Keep “official hosted services” and “official bot” as the future paid layer (optional).

**Why this works**

- Viral now: frictionless for builders to try/extend.
- Monetize later: the paid product is convenience + hosting + premium bot features, not “closed code”.

## 2) Who is the fanatic (early adopters)

Primary:
- AI agent builders (want a “real world” to plug their agent into)
- Indie hackers / builder-twitter (want something shippable + remixable)

Secondary:
- Cozy multiplayer + “digital pet” players
- Nostalgia MMO players (but don’t rely on this for messaging)

## 3) One-liner positioning (Gen Z friendly)

Pick ONE and repeat it everywhere:

Option A (most general): **“A multiplayer town where your AI pet levels up for you.”**
Option B (maker angle): **“Bring your agent. It lives in a tiny MMO world.”**
Option C (share angle): **“Your AI companion plays while you’re away — and sends you updates.”**

## 4) Distribution channels (where to post)

Day 1 (fast feedback):
- X/Twitter (ship thread + short clip)
- Discord (community + daily polls)
- Reddit: r/LocalLLaMA (agent builders), r/IndieDev (builders)

Day 2 (bigger spike):
- Hacker News “Show HN” (open-source + demo)
- Product Hunt (if you have assets ready; optional)

## 5) Content assets (minimum viable marketing)

- 15–30s vertical clip:
  - 3s hook: “Your AI pet levels up for you.”
  - 10s demo: move → kill slime → share/invite
  - 5s bot: toggle H-Mode (built-in CloudBot) → optional: show Join Token to connect any agent
  - 3s CTA: “Try now: clawtown.io”
- Script + shotlist: `DEMO_CLIP.md`
- 1 screenshot: map + slimes + panel (desktop) and 1 mobile screenshot.
- README above-the-fold: one-liner + demo + “Try now” + “Connect your agent”.

## 6) Discord loop (daily poll → ship daily)

Channels:
- `#announcements` (shiplog only)
- `#bugs` (templates, repro)
- `#ideas` (brainstorm)
- `#polls` (daily vote)
- `#screenshots` (share loop)
- `#bot-brains` (agent dev)

Daily ritual (15 minutes):
1) Bot posts poll with 2–3 options (pre-curated)
2) Community votes
3) Top vote becomes a GitHub issue
4) Ship the winning feature in 24h
5) Post changelog + 1 clip/screenshot

## 7) 48-hour schedule (do this in order)

### T-48 to T-36 (Prep)

- Repo hygiene: license + contributing + code of conduct + issue templates.
- “Try now” works: deploy + verify smoke on prod.
- Add a tiny “Join Discord” link in UI/README (once the server exists).

### T-36 to T-24 (Activation polish)

- Confirm Aha path timing (screen-record it).
- Ensure “Share” works on iOS/Android (Web Share; clipboard fallback).
- Ensure “Invite a friend” copy is clear and includes link.

### T-24 to T-12 (Open-source drop)

- Make GitHub issues:
  - 10 “good first issue” (UX, content, docs)
  - 5 “agent adapters” (OpenClaw, NanoClaw, generic Node/Python)
- Write “How to add a new monster / map / skill” mini-doc (fast wins).

### T-12 to T-0 (Launch)

- Post the clip + one-liner (X/Twitter).
- Post “Show HN” with:
  - 1-line pitch
  - demo link
  - agent spec link
  - ask: “Build an adapter for your agent framework.”
- Run a community challenge:
  - “Design the next slime family (name + colors + behavior)”

## 8) Success metrics (first 24 hours)

- Activation: % first kill within 60s
- Share: shares per activated user
- Invite: join tokens generated per activated user
- Community: Discord joins + poll participation
- Builders: forks + PRs + adapter submissions
