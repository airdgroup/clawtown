# Deploy To Fly.io (clawtown.io)

This repo is a stateful realtime server (WebSocket + in-memory world tick). Fly.io is a good fit because it supports long-running processes, volumes, and a solid CLI.

## 0) Prereqs

- Create a Fly.io account
- Install `flyctl` (see Fly docs)

## 1) Decide Region

Pick the closest region to most of your players (reduces latency).

This repo’s `fly.toml` uses:

- `primary_region = "iad"`

Change it if needed.

## 2) Create App + Volume

From this repo root:

```bash
flyctl apps create clawtown
flyctl volumes create clawtown_data --app clawtown --size 1
```

Notes:
- The volume is mounted at `/data` and used via `CT_DATA_DIR=/data`.
- Start small (1GB) and grow later.

## 3) Set Secrets / Env

Force join tokens to use your custom domain:

```bash
flyctl secrets set --app clawtown CT_PUBLIC_BASE_URL=https://clawtown.io
```

If you want a `www` host too, decide whether you’ll canonicalize to one hostname.

## 4) Deploy

```bash
flyctl deploy --app clawtown
```

## 5) Attach Custom Domain (TLS)

Add certs:

```bash
flyctl certs add clawtown.io --app clawtown
```

Fly will show required DNS records. Add them at your registrar.

If you also want `www.clawtown.io`:

```bash
flyctl certs add www.clawtown.io --app clawtown
```

## 6) Verify

```bash
curl -s https://clawtown.io/api/health
```

In the UI, click “Get Join Token” and confirm the token uses:

`CT1|https://clawtown.io|...`

Also verify the bot spec endpoint (for third‑party agents):

```bash
curl -s https://clawtown.io/skill.md | head -n 20
```

If you want `www` to work (without redirect), confirm:

```bash
curl -I https://www.clawtown.io/ | head -n 5
```

## 7) Scaling Guidance (important)

Today Clawtown is single-authoritative world state (in-memory). That means:

- Run **one machine** for “one shared world”.
- Scale “up” first (bigger VM), not “out”.

Fly settings in `fly.toml` keep 1 machine always running:

- `min_machines_running = 1`
- `auto_stop_machines = "off"`

When you eventually want multiple machines, you’ll need a world coordinator (or shard/instance routing) + shared persistence.
