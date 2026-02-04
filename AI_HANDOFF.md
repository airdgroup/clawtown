# Clawtown AI Handoff

If you were given this folder with no other context, start here.

Goal

- Keep Clawtown a simple-but-addictive RO-like loop: kill -> loot -> equip -> stronger -> repeat.
- Support both manual play and autonomous play (H-Mode) via the bot REST API.
- Keep tests deterministic and non-flaky.

Repo status

- Stable branch: `main`
- `feat/*` branches exist for exploration, but `main` contains the current shipped game.

When in doubt: `git switch feat/stats-v1` and run the quality gates.

Quick start

1) Install + run

```bash
npm install
npm run dev
```

Open: http://localhost:3000

2) Run tests

```bash
npm run test:ui
```

If snapshots are expected to change:

```bash
npm run test:ui:update
```

Core UX (current)

- Desktop layout: the left stage (map + actionbar) is fixed; only the right panel scrolls.
- Language: zh-Hant / EN toggle lives on the right panel top bar; selection persists in localStorage (`clawtown.lang`).
- Player growth: level gives stat points; allocate STR/AGI/VIT/INT/DEX/LUK; derived stats update.
- Monsters: default 5 slimes with distinct palette-friendly colors.
- Bot: "Bot Thoughts" is derived from chat lines that begin with `[BOT]`.

Bot control model

- Link flow:
  - user generates join token in UI: `CT1|<baseUrl>|<joinCode>`
  - bot calls `POST /api/bot/link` with `{joinToken}` and receives a `botToken`
- Bot API (bearer token):
  - `POST /api/bot/mode` {mode:"agent"|"manual"}
  - `GET /api/bot/world`
  - `POST /api/bot/goal` {x,y}
  - `POST /api/bot/cast` {spell, x?, y?}
  - `POST /api/bot/intent` {text}
  - `POST /api/bot/chat` {text}
  - `GET /api/bot/status` (concise JSON for chat apps)
  - `GET /api/bot/events?cursor=0&limit=20` (cursor-based event feed)
  - `POST /api/bot/thought` {text} (short “thought bubble”, no chat spam)
  - `GET /api/bot/map.png` / `GET /api/bot/minimap.png` (map-only images)

Important behavior

- Join codes are persisted to disk (`.data/join_codes.json`) and survive restarts (24h TTL).
- Bot tokens are persisted to disk (`.data/bot_tokens.json`) and survive restarts.
- If a bot token ever becomes invalid (e.g. rotation), bots should re-link via join token.
- Fallback autopilot exists: if a player is linked + in H-Mode but no external bot is issuing actions recently, the server will move/fight and emit `[BOT]` lines. Read-only polling (events/status/map) does not disable autopilot.

Persistence

- Player saves live at: `.data/players/<playerId>.json`
- `.data/` is ignored by git.

Deployment note (custom domain)

- If you deploy Clawtown behind a reverse proxy / custom domain (e.g. `https://clawtown.io`), set:
  - `CT_PUBLIC_BASE_URL=https://clawtown.io`
- This ensures join tokens contain a bot-reachable URL.

Testing strategy

- Playwright runs the server in `CT_TEST=1` mode and uses debug endpoints to avoid flakiness.

Debug endpoints (CT_TEST=1 only)

- `POST /api/debug/reset`
- `POST /api/debug/teleport`
- `POST /api/debug/spawn-monster` (supports `color`)
- `POST /api/debug/grant-item`
- `POST /api/debug/persist-flush`
- `POST /api/debug/restart-sim`

Quality gates

Always keep these green before merging to `main`:

1) `npm run test:ui`

Optional (if Moltbot repo exists on the machine):

- Host-only closed loop:

```bash
node /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app/scripts/clawtown-ui-e2e.mjs --baseUrl http://localhost:3000 --runForMs 20000
```

If you only have this repo (no Moltbot):

- Use `./scripts/cloudbot-local.sh '<joinToken>'` as a basic bot loop.

Known product direction (next)

- Simplify stats: 6 stats are likely too complex for most players; converge to 2-3 high-signal stats.
- Bot connection UX: support multi-channel (Telegram/WhatsApp/WebChat/etc.) by making join token a first-class payload (not a "paste curl" prompt).
- UI simplification: reduce tab count and keep "Link Bot" obvious.
