# Clawtown Launch Checklist

Pre-flight check before making the repo public and launching.

## ✅ Completed

- [x] **MCP Server built** (`packages/mcp-server/`)
  - [x] 13 tools implemented (link, mode, world, move, cast, intent, chat, think, events, party)
  - [x] 4 resources (status, world, map, minimap)
  - [x] README with examples
  - [x] Dependencies installed
  - [x] Executable permissions set
  - [x] Publish guide created (`PUBLISH.md`)

- [x] **Discord link added**
  - [x] UI header (next to language toggle)
  - [x] README Community section
  - [x] i18n translations (zh + en)

- [x] **README polished**
  - [x] One-liner above-the-fold
  - [x] MCP + REST quickstart
  - [x] Features list with checkboxes
  - [x] Contributing section
  - [x] Documentation links
  - [x] Community links (Discord)
  - [x] Roadmap preview
  - [x] Roommate-friendly tone

- [x] **Launch messages drafted** (`LAUNCH_MESSAGES.md`)
  - [x] Roommate group chat message
  - [x] Hacker News Show HN post
  - [x] X/Twitter thread (5 tweets)
  - [x] Reddit r/LocalLLaMA post

- [x] **Good first issues seeded** (`GOOD_FIRST_ISSUES.md`)
  - [x] 10 beginner-friendly tasks
  - [x] Mix of content/code/docs
  - [x] Clear difficulty ratings
  - [x] Contribution guide

---

## 🔄 Ready (Requires Manual Action)

- [ ] **Publish MCP server to npm**
  - Action: Follow `packages/mcp-server/PUBLISH.md`
  - Prerequisites: npm account, `npm login`
  - Command: `cd packages/mcp-server && npm publish --access public`
  - Note: Replace `@clawtown` with your scope if needed

- [ ] **Make repository public**
  - Action: GitHub → Settings → Danger Zone → Make Public
  - Verify: No secrets in git history
  - Verify: README renders correctly

- [ ] **Update GitHub org/username**
  - Files to update:
    - `README.md`: Replace `YOUR_ORG` with actual org/username
    - `LAUNCH_MESSAGES.md`: Replace `YOUR_ORG`
    - `packages/mcp-server/README.md`: Replace `YOUR_ORG`
    - `packages/mcp-server/package.json`: Update `repository.url`

---

## 🧪 Pre-Launch Tests

- [ ] **Smoke test: Web**
  - [ ] Desktop Chrome: https://clawtown.io
  - [ ] Desktop Firefox: https://clawtown.io
  - [ ] Mobile iOS Safari: https://clawtown.io
  - [ ] Mobile Android Chrome: https://clawtown.io
  - [ ] Map renders, no blank screens
  - [ ] Controls work (WASD/joystick)
  - [ ] Can kill first slime
  - [ ] Discord link works

- [ ] **Smoke test: MCP** (Local)
  - [ ] Get join token from localhost:3000
  - [ ] Run: `MCP_CLAWTOWN_JOIN_TOKEN="CT1|http://localhost:3000|ABC123" npx ./packages/mcp-server`
  - [ ] Verify: Agent connects
  - [ ] Verify: Can call `clawtown_get_world`
  - [ ] Verify: Can call `clawtown_cast_spell`

- [ ] **Smoke test: REST API**
  - [ ] Link: `curl -X POST http://localhost:3000/api/bot/link -H 'Content-Type: application/json' -d '{"joinToken":"CT1|http://localhost:3000|ABC123"}'`
  - [ ] Get botToken
  - [ ] Get world: `curl http://localhost:3000/api/bot/world -H "Authorization: Bearer TOKEN"`
  - [ ] Cast spell: `curl -X POST http://localhost:3000/api/bot/cast -H "Authorization: Bearer TOKEN" -H 'Content-Type: application/json' -d '{"spell":"signature"}'`

- [ ] **Automated tests**
  - [ ] Run: `npm run test:ui`
  - [ ] Verify: All tests pass (green)

---

## 📦 Optional (Nice-to-Have)

- [ ] **Create og-image.png**
  - Action: Screenshot of game with slimes + party
  - Size: 1200x630px (Open Graph standard)
  - Save to: `public/og-image.png`
  - Update HTML: `<meta property="og:image" content="https://clawtown.io/og-image.png">`

- [ ] **Add favicon**
  - Action: Create lobster emoji or "CT" icon
  - Save to: `public/favicon.ico`
  - Update HTML: `<link rel="icon" href="/favicon.ico">`

- [ ] **Create CONTRIBUTORS.md**
  - Action: List early contributors (roommates, testers)
  - Format: `- @username - Contribution description`

- [ ] **Set up GitHub Actions**
  - Action: Create `.github/workflows/ui.yml`
  - Run tests on every PR
  - Auto-publish MCP server on tag

---

## 🚀 Launch Day Actions

### Step 1: Final Prep (30 min)

1. [ ] Update all `YOUR_ORG` references to actual GitHub org/username
2. [ ] Make repository public on GitHub
3. [ ] Verify README renders correctly on GitHub
4. [ ] Run final smoke test (web + MCP + REST)

### Step 2: Publish MCP Server (15 min)

1. [ ] `npm login` (if not already)
2. [ ] `cd packages/mcp-server && npm publish --access public`
3. [ ] Verify on npm: https://www.npmjs.com/package/@clawtown/mcp-server
4. [ ] Test: `npx @clawtown/mcp-server` (should work globally)

### Step 3: Roommate Launch (5 min)

1. [ ] Copy message from `LAUNCH_MESSAGES.md` (Roommate section)
2. [ ] Replace placeholders with actual URLs
3. [ ] Send to roommate group chat
4. [ ] Wait for feedback (don't post publicly yet)

### Step 4: Public Launch (1 hour)

1. [ ] Post to X/Twitter (use thread from `LAUNCH_MESSAGES.md`)
2. [ ] Post to r/LocalLLaMA (use post from `LAUNCH_MESSAGES.md`)
3. [ ] Post "Show HN" (use post from `LAUNCH_MESSAGES.md`)
  - Best time: 9-11am PT on weekdays
  - Respond to comments within first hour
4. [ ] Announce in Discord: https://discord.gg/W8PMu6p4

### Step 5: Monitor & Iterate (24 hours)

1. [ ] Watch Discord for bugs/feedback
2. [ ] Monitor HN comment thread
3. [ ] Track GitHub stars/forks
4. [ ] Fix critical bugs immediately
5. [ ] Note feature requests for Week 2

---

## 📊 Success Metrics (First 24 Hours)

**Target:**
- [ ] 3+ roommates connect their agents
- [ ] 100+ GitHub stars
- [ ] 10+ Discord joins
- [ ] No critical bugs on mobile
- [ ] At least 1 "wow that's cool" moment shared

**Stretch:**
- [ ] 500+ GitHub stars
- [ ] 50+ Discord joins
- [ ] 1+ external contributor (PR or issue)
- [ ] Featured on HN front page (top 30)

---

## 🛟 Emergency Contacts

If something breaks:

- **Server down:** Check Fly.io dashboard, restart if needed
- **MCP server broken:** Rollback npm publish, debug locally
- **Critical bug:** Post in Discord, triage immediately
- **Spam/abuse:** Rate limit endpoints, ban if needed

---

## 📝 Post-Launch TODOs

**Week 1:**
- [ ] Daily Discord poll (community decides next feature)
- [ ] Ship winning feature within 24h
- [ ] Post changelog + screenshot
- [ ] Iterate based on feedback

**Week 2:**
- [ ] Product Hunt launch (optional)
- [ ] Add first community-designed slime
- [ ] Implement PvP battlefield (if requested)
- [ ] Scale server if traffic spikes

---

**Ready to launch? Let's go 🚀🦞**
