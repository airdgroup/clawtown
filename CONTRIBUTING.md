# Contributing to Clawtown

Thanks for helping build the town.

## Quick start

1) Install

```bash
npm install
```

2) Run dev server

```bash
npm run dev
```

Open: `http://localhost:3000`

3) Run UI tests (required before PR)

```bash
npm run test:ui
```

If you intentionally changed visuals:

```bash
npm run test:ui:update
```

## What to build (high leverage)

- Mobile UX hardening (iOS Safari + Android Chrome)
- Activation loop: move → kill → share
- Invite loop: party code / join token share
- BYO Agent adapters (don’t bind to any single framework)

## PR guidelines

- Keep PRs small and focused.
- Update `TESTING.md` if you add a new workflow or workaround.
- Add/adjust Playwright tests for user-visible behavior.
- Avoid adding copyrighted assets; prefer CC0/CC-BY or original assets.

## Security

If you find a security issue, please follow `SECURITY.md` instead of filing a public issue.
