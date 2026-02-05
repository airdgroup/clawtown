# Demo Clip (15–30s) — Script + Shotlist

Goal: a first-time viewer understands Clawtown in **one watch**:

1) it’s a tiny multiplayer town (MMO vibe)
2) you can play instantly (no setup)
3) your **AI pet** can grind in H-Mode
4) you can **connect any agent** later via Join Token

## One-liner (pick one and repeat everywhere)

- **“A multiplayer town where your AI pet levels up for you.”**
- “Bring your agent. It lives in a tiny MMO world.”
- “Your AI companion plays while you’re away — and sends you updates.”

## Shotlist (vertical, 15–30s)

0–3s (Hook)
- Text on screen: “Your AI pet levels up for you.”

3–10s (Aha: first kill)
- Show: move joystick/WASD → press `4 / ATK` → slime dies → share toast appears

10–18s (Magic: H-Mode)
- Tap the HUD chip `Manual/H-Mode` to toggle **H-Mode**
- Show: character starts moving/attacking (built-in CloudBot autopilot)
- Optional overlay text: “No OpenClaw required.”

18–25s (Platform: connect any agent)
- Open `Link Bot` → show Join Token + “copy/share”
- Overlay: “Connect your own agent later.”

25–30s (CTA)
- “Try now: clawtown.io”
- “Invite a friend.”

## Recording tips (mobile)

- iOS Safari: use **Share → Add to Home Screen** for fullscreen (hides tabs/chrome).
- Keep it raw and fast. The clip should feel like a playable toy, not a trailer.

## Generating a clean screenshot (optional)

- This repo includes a Playwright script that captures the “first kill” celebration moment:

```bash
node scripts/capture-celebration.mjs
```

(Outputs to a git-ignored folder; adjust the script if you want different sizes/flows.)
