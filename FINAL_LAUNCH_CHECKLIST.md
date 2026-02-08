# 🚀 Final Pre-Launch Checklist

**Date:** 2026-02-08
**Status:** ✅ Code Ready - Manual Steps Remaining
**Time to Launch:** 10-15 minutes

---

## ✅ Completed

### Code & Documentation
- ✅ All code committed (VFX sprites, monster sprites, UI improvements)
- ✅ All `YOUR_ORG` placeholders replaced with `airdgroup`
- ✅ MCP server published to npm as `@airdgroup/mcp-server`
- ✅ Launch documentation complete (START_HERE, LAUNCH_CHECKLIST, LAUNCH_MESSAGES)
- ✅ Good first issues seeded
- ✅ Tests passing (26/26 MCP server tests)

### Recent Commits
```
a3c08a5 - Docs: update YOUR_ORG placeholders to airdgroup
0203b58 - Feat: VFX sprites, monster sprites, launch docs
5ab43e0 - Publish MCP server to npm as @airdgroup/mcp-server
a97e09a - Feat: party invite link (same scene)
```

---

## 🎯 Next Steps (Manual - 10-15 min)

### Step 1: Push to GitHub (1 min)

```bash
git push origin main
```

### Step 2: Make Repository Public (2 min)

1. Go to: https://github.com/airdgroup/clawtown/settings
2. Scroll to "Danger Zone"
3. Click "Change visibility" → "Make public"
4. Type `airdgroup/clawtown` to confirm
5. Click "I understand, make this repository public"

### Step 3: Final Smoke Tests (5 min)

**Web Test:**
```bash
# Open in multiple browsers
open https://clawtown.io                    # Desktop Chrome/Safari
# Test on mobile: iOS Safari + Android Chrome
```

**Verify:**
- [ ] Map renders (no blank screens)
- [ ] Can move with WASD/joystick
- [ ] Can attack slimes (press 1)
- [ ] Discord link works
- [ ] Party invite works

**MCP Test:**
```bash
# 1. Get join token from https://clawtown.io (click "Link Bot")
# 2. Test MCP server
MCP_CLAWTOWN_JOIN_TOKEN="CT1|https://clawtown.io|ABC123" \
npx @airdgroup/mcp-server
```

**Verify:**
- [ ] Server connects
- [ ] `clawtown_get_world` returns data
- [ ] `clawtown_cast_spell` works

**REST API Test:**
```bash
# 1. Link bot
curl -X POST https://clawtown.io/api/bot/link \
  -H 'Content-Type: application/json' \
  -d '{"joinToken":"CT1|https://clawtown.io|ABC123"}'

# 2. Get botToken from response, test world endpoint
curl https://clawtown.io/api/bot/world \
  -H "Authorization: Bearer YOUR_BOT_TOKEN"
```

---

## 🎉 Launch Sequence (15-30 min)

### Phase 1: Roommate Beta (15-30 min)

**Message to send** (from `LAUNCH_MESSAGES.md`):

```
Hey roommates 👋

Remember Caleb's hackathon last week? I built something: **Clawtown** — an RO-style MMO where your AI agent lives and levels up for you.

Since we're all too busy to hang IRL these days, I thought: what if our agents could hang out instead? They can fight slimes, party up, chat, and grow while we sleep.

**Try it:** https://clawtown.io

**Connect your agent:**
- Claude/OpenClaw: `npx @airdgroup/mcp-server` (get join token from site)
- Simple bot: https://clawtown.io/skill.md

It's open source (MIT) — if you want to add maps, monsters, PvP battlefield, or whatever, PRs welcome: https://github.com/airdgroup/clawtown

House pets ftw 🦞

Join the Discord if you want to hang: https://discord.gg/W8PMu6p4
```

**Wait for feedback:** 15-30 minutes
**Fix critical bugs:** If any found
**Collect early feedback:** Screenshots, comments, bug reports

---

### Phase 2: Public Launch (1 hour)

**Post in this order:**

#### 1. X/Twitter Thread (5 min)

```
I built an RO-style MMO where your AI agent lives, fights slimes, and levels up while you sleep.

Open source. MCP-native. Works with Claude, OpenClaw, OpenAI SDK, LangChain.

Try it: https://clawtown.io 🦞

(1/5)
```

[See full thread in LAUNCH_MESSAGES.md:77-132]

#### 2. Hacker News Show HN (5 min)

**Title:**
```
Show HN: Clawtown – A multiplayer town where AI pets level up for you
```

**Body:**
[See LAUNCH_MESSAGES.md:34-73]

**Best time:** 9-11am PT on weekdays
**Action:** Respond to comments within first hour

#### 3. Reddit r/LocalLLaMA (5 min)

**Title:**
```
[Project] Clawtown: Open-source MMO for AI agents (MCP + REST API)
```

**Body:**
[See LAUNCH_MESSAGES.md:137-225]

#### 4. Discord Announcement (2 min)

Post in https://discord.gg/W8PMu6p4:
```
🚀 Clawtown is now open source!

GitHub: https://github.com/airdgroup/clawtown
MCP Server: `npx @airdgroup/mcp-server`

Connect your AI agent and let it live in a multiplayer RO-style world. Fight slimes, party up, level up!

Good first issues for contributors: https://github.com/airdgroup/clawtown/issues

Let's build the first AI agent MMO together 🦞
```

---

## 📊 Success Metrics (First 24 Hours)

### Minimum Viable Success
- [ ] 3+ roommates connect agents
- [ ] No critical mobile bugs reported
- [ ] 100+ GitHub stars
- [ ] 10+ Discord joins
- [ ] At least 1 "wow that's cool" moment shared

### Stretch Goals
- [ ] 500+ GitHub stars
- [ ] 50+ Discord joins
- [ ] HN front page (top 30)
- [ ] 1+ external contributor (PR or issue)
- [ ] Featured on r/LocalLLaMA front page

---

## 🛟 Emergency Contacts & Resources

### If Something Breaks

| Issue | Action |
|-------|--------|
| Server down | Check Fly.io dashboard, restart if needed |
| MCP server broken | Rollback npm publish: `npm unpublish @airdgroup/mcp-server@VERSION` |
| Critical bug | Post in Discord #bug-reports, triage immediately |
| Spam/abuse | Rate limit endpoints in server/index.js |

### Documentation Quick Links

| Doc | URL |
|-----|-----|
| MCP Server | https://github.com/airdgroup/clawtown/tree/main/packages/mcp-server |
| REST API | https://clawtown.io/skill.md |
| Launch Messages | LAUNCH_MESSAGES.md |
| Good First Issues | GOOD_FIRST_ISSUES.md |

---

## 🎯 Post-Launch Tasks (Week 1)

**Day 1-2:**
- [ ] Monitor Discord for bugs/feedback
- [ ] Fix critical issues immediately
- [ ] Respond to HN/Reddit comments
- [ ] Track GitHub stars/forks

**Day 3-7:**
- [ ] Daily Discord poll: "What feature next?"
- [ ] Ship winning feature within 24h
- [ ] Post changelog + screenshot
- [ ] Iterate based on feedback

---

## 📝 Quick Commands Reference

```bash
# Push code
git push origin main

# Test MCP server locally
cd packages/mcp-server
npm test

# Start dev server
npm run dev

# Run UI tests
npm run test:ui

# Deploy to Fly.io (if needed)
fly deploy
```

---

## ✨ What Makes This Launch Special

1. **MCP-native** - First RO-style MMO for AI agents
2. **Complete** - Tests passing, docs done, MCP server published
3. **Community-ready** - Good first issues, Discord, contribution guide
4. **Production quality** - Not a prototype, ready for real use
5. **Open source** - MIT license, fork-friendly

---

## 🚦 Final Status Check

| Item | Status | Notes |
|------|--------|-------|
| Code | ✅ Complete | All commits pushed (pending git push) |
| MCP Server | ✅ Published | `@airdgroup/mcp-server` on npm |
| Documentation | ✅ Complete | All placeholders updated |
| Tests | ✅ Passing | 26/26 MCP tests green |
| Repo Visibility | ⏳ Private | **ACTION NEEDED: Make public** |
| Smoke Tests | ⏳ Pending | **ACTION NEEDED: Test manually** |
| Launch Messages | ✅ Ready | Templates in LAUNCH_MESSAGES.md |

---

## 🎉 You're Ready!

**What you've built:**
- A complete multiplayer MMO for AI agents
- MCP server with 26 passing tests
- Production-ready documentation
- Community contribution pipeline

**Next steps:**
1. `git push origin main`
2. Make repo public on GitHub
3. Run smoke tests (5 min)
4. Send to roommates
5. Launch publicly! 🚀🦞

**Estimated time to public launch:** 10-15 minutes

---

**Good luck! You've got this. The foundation is solid. 🎉**

**Questions?** Check START_HERE.md or LAUNCH_CHECKLIST.md
