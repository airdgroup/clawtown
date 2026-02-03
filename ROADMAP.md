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

Proving tests (examples)

- `World: spawns 5 colored slimes`
- `Layout: right panel scroll does not move map`
- `Stats: allocating STR increases ATK and persists (CT_TEST)`
- `Party: create/join and share XP on elite kill`

Next (highest leverage)

1) Bot connection UX (multi-channel)

- Goal: user can connect from Telegram/WhatsApp/Slack/WebChat/etc.
- Replace “paste curl prompt” with a deterministic connect payload:
  - user sends `CT1|<baseUrl>|<joinCode>` (or `/clawtown connect <joinToken>`) to Moltbot
  - Moltbot links + switches mode + runs loop, then posts thoughts back to Clawtown

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
