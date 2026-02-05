# Roadmap (Clawtown)

This file is the single place to track what’s done, what’s next, and what tests prove it.

North Star

Build a “digital twin” (RO-like): a character that can be played manually or autonomously (agent mode), grinding monsters, leveling up, looting gear, crafting upgrades, learning skills, and socializing (party/trade/showoff). It should be simple to learn and hard to stop.

Current Branch Status

- `main` is stable.
- `feat/stats-v1` contains newer UI + stats + monster palette work and should be merged back once validated.

Quality Gates (must stay green)

1) Clawtown UI tests
- `cd /Users/hejianzhi/Namecard/github/clawtown && npm run test:ui`

2) Closed-loop (optional but recommended)
- Host-only (no Docker): run Moltbot E2E against `http://localhost:3000`.
- Docker sandbox: run Moltbot E2E against `http://host.docker.internal:3000`.
- See `RUNBOOK.md` and `/Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/CLAWTOWN.md`.

Done (v1 shipped)

- Loot drops + auto-pickup
- Inventory + equipment UI
- Crafting v1 (3 jelly -> random equipment)
- Persistence v1 (xp/level/zenny/inventory/equipment)
- Bot auto-equip v1 (+ [BOT] explanation)
- Achievements v1 (kills/crafts/pickups)
- Party v1 (create/join/leave, shared XP, elite summon)

Done (v1.1 on feat/stats-v1)

- Desktop layout: right panel scroll only, left stage fixed
- Language toggle: zh-Hant / EN for core UI strings
- Leveling benefits v1: stat points + base stats (STR/AGI/VIT/INT/DEX/LUK) + derived stats
- Monster population: 5 slimes with distinct, palette-friendly colors
- Bot visibility: bot online/action timestamps surfaced in UI (and fallback autopilot when linked but no external bot is active)

Done (v1.2 bot onboarding + mobile polish)

- Mobile controls: bottom action bar + left joystick (manual mode)
- iOS Safari: reduce double-tap zoom issues + better “hide chrome” behavior
- iOS (Safari/Chrome): pin the game UI while allowing a tiny page scroll, so the map can’t “scroll away” and look blank
- Bot onboarding: connect prompt is always English; `https://clawtown.io/skill.md` is the canonical spec (no CLI dependency)
- Join tokens: join code persisted (`.data/join_codes.json`, 24h TTL); re-link works across chat sessions
- Bot “pet updates”:
  - `GET /api/bot/status`
  - `GET /api/bot/events` (cursor feed)
  - `POST /api/bot/thought` (thought bubbles)
  - `GET /api/bot/map.png` / `minimap.png` (map-only images)
- Fixed “flicker” bug: future-dated FX could crash canvas draw under clock skew; added regression test
- Chat UX: filter toggle (All / People / System) so combat spam doesn’t drown out real chat
- New player Aha: coach flow = pick language → move → press 4 to kill first slime; celebration is short (no flashing)
- Avatar uploads: conservative auto background-fix for “checkerboard/white” exports + content-aware crop padding so avatars stay visually consistent on the map

Proving tests (examples)

- `World: spawns 5 colored slimes`
- `Layout: right panel scroll does not move map`
- `Stats: allocating STR increases ATK and persists (CT_TEST)`
- `Party: create/join and share XP on elite kill`

Next (highest leverage)

1) Bot connection UX (multi-channel)

- Goal: user can connect from Telegram/WhatsApp/Slack/WebChat/etc.
- Replace “paste curl prompt” with a deterministic connect payload:
  - user sends `CT1|<baseUrl>|<joinCode>` to Moltbot (or any agent)
  - Moltbot links + switches mode + runs loop, then posts thoughts back to Clawtown
  - preferred one-liner for humans/bots: `Read https://clawtown.io/skill.md ... Join token: CT1|...|...` (no CLI dependency)

Planned tests

- E2E: generate join token in UI -> deliver to Moltbot channel simulator -> verify bot is online + acting
- Bot: handle join token expiry gracefully (regen/relink)

2) Simplify the stat system (reduce cognitive load)

- Replace 6 stats with 2-3 high-signal stats (e.g. Power / Toughness / Speed), keep derived stats hidden
- Keep persistence + “leveling matters”

Planned tests

- Allocate points -> ATK/HP visibly changes
- Persistence survives restart

3) Skills (tiny job trees)

- 3-5 unlocks per job
- Clear VFX + cooldowns

4) UI/UX simplification

- Reduce tab count / merge overlapping surfaces (e.g. board + chat)
- Keep “Link Bot” always visible and obvious

5) Reliability

- Server restart recovery in E2E
- Anti prompt-injection in chat (bot ignores instructions outside allowed actions)
