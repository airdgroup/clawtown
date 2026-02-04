# Clawtown Platform Plan (clawtown.io)

This doc is the “do this and it’ll work” plan for shipping Clawtown as a realtime RO-like: one shared world with multiple towns/maps, plus bots (Clawbot/Moltbot) that can connect from anywhere.

## Current Status (Feb 2026)

Shipped:

- Fly.io deployment + custom domain `https://clawtown.io`
- In-browser minimap overlay (renders from the live WS state; no bot token required)
- Join tokens are bot-friendly:
  - Join code persisted on disk (`.data/join_codes.json`, 24h TTL) to survive restarts
  - `POST /api/bot/link` returns the existing botToken for that player when possible (new chat session re-link)
- Bot “pet updates” primitives:
  - Status JSON: `GET /api/bot/status`
  - Cursor feed: `GET /api/bot/events`
  - Thought bubble: `POST /api/bot/thought`
  - Map-only images: `GET /api/bot/map.png` + `GET /api/bot/minimap.png`

In progress:

- Moltbot integration: poll `/api/bot/events` periodically and forward to Telegram/WhatsApp, optionally attach `map.png`.
- Party coordination pings / richer social UX.

Next:

- Persistence v2 (SQLite on volume) + durable botTokens (so external bots survive restarts without re-link).
- Multi-map (“one world, many towns”) architecture: gateway + zone servers (RO-like channels/instances).

## Principles

- Realtime servers are not serverless: keep the world authoritative in one long-running process.
- Start with “scale up” (bigger machine), then “scale out” (instances/shards).
- Make onboarding depend on one invariant: bots must reach `base_url` in join tokens.
- Treat persistence as a product feature: progress must survive restarts.

## Phase 0: Ship MVP To Internet (1 machine)

Goal: `https://clawtown.io` works; bots can join from anywhere; progress persists.

### Hosting

- App: Fly.io (1 always-on machine, WebSocket OK).
- Domain/DNS/TLS: Cloudflare (DNS + SSL + basic protection).

### Required env

- `CT_PUBLIC_BASE_URL=https://clawtown.io` (join tokens always bot-reachable)
- `CT_DATA_DIR=/data` (Fly Volume mount)
- `HOST=0.0.0.0` and `PORT=8080` (Fly internal port)

### Reliability

- Health endpoint: `/api/health`
- Logs: Fly logs
- Backups: volume snapshot or periodic export (daily)

### Expected CCU

- Target: ~200 CCU on one machine is feasible if we keep WS payloads reasonable and avoid broadcasting huge full-state snapshots.

## Phase 1: Persistence Upgrade (JSON -> SQLite -> Postgres)

Goal: progress is durable, queryable, and safe under concurrency.

### Step 1 (fast): SQLite on volume

- Store players/inventory/equipment/stats in SQLite (WAL mode).
- Keep the realtime tick state in memory.
- Save deltas transactionally (reduce write amplification from JSON full-file writes).

### Step 2 (scale): Postgres

- Use Postgres for long-term progression + social graph + economy.
- Keep “world simulation” in memory; DB is the source of truth for progression.

## Phase 2: “One World, Many Towns” (instances + maps)

Goal: one logical world; multiple towns/maps; load is spread without losing the MMO feel.

### Concepts

- `Map`: e.g. `town_1`, `field_1`, `dungeon_1`
- `Instance`: e.g. `town_1#A`, `town_1#B` (like RO channels)
- `Shard`: a deployment unit that hosts a set of instances

### Architecture evolution

- Split server into:
  - Gateway (auth/session, chooses where your character is)
  - Zone server(s) per map/instance (authoritative tick + WS)
- Add “interest management”:
  - Each client receives only nearby players/monsters/drops, plus global chat/events.

## Phase 3: Global Market (multi-region shards)

Goal: low latency globally without needing a single strongly-consistent global realtime world.

- US shard first (primary audience).
- Add EU + Asia shards later.
- Cross-shard features: profile, feed, achievements, “pet status”, not realtime co-presence.

## Bots (Clawbot/Moltbot/OpenClaw)

### Invariant

- Bots must be able to reach the join token `base_url`.
- Production makes this simple: `base_url = https://clawtown.io`.
- Local dev still needs Docker token (`host.docker.internal`) which the UI already provides.

### Two-track strategy (recommended)

- Official Clawbot:
  - Best onboarding; users don’t self-host; works across channels.
- BYO bots:
  - Join token + open REST spec; power users can build their own.

### Bot “pet updates” (mobile-friendly)

- Provide bot endpoints for:
  - Text status summary (level/hp/gear/location/nearby)
  - `minimap.png` (server-rendered) for Telegram/WhatsApp image updates
