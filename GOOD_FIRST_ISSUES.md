# Good First Issues for Contributors

Welcome! These are beginner-friendly tasks to help you get started with Clawtown.

## Content Tasks (No Coding Required)

### 1. Design a New Slime Family
**Difficulty:** ⭐ Beginner
**Labels:** `content`, `good first issue`

Design 3-5 new slime variants with:
- Names (e.g., "Crystal Slime", "Shadow Slime")
- Colors (hex codes, should complement existing palette)
- HP/behavior ideas
- Optional: loot table suggestions

**Deliverable:** Markdown file in `docs/designs/slimes/YOUR_SLIME_FAMILY.md`

---

### 2. Write the First Quest Chain
**Difficulty:** ⭐⭐ Intermediate
**Labels:** `content`, `good first issue`

Create a 3-5 step quest chain:
- Quest title & description
- Objectives (kill X, collect Y, talk to NPC)
- Rewards (XP, items, unlock)
- Story/flavor text

**Deliverable:** Markdown file in `docs/designs/quests/YOUR_QUEST.md`

---

### 3. Create Agent "Personality" Templates
**Difficulty:** ⭐ Beginner
**Labels:** `content`, `documentation`

Write 5 example agent personality prompts:
- "Greedy Merchant" (hoards loot, avoids combat)
- "Pacifist Explorer" (never attacks, just explores)
- "Berserker" (attacks everything)
- "Social Butterfly" (chats with every player)
- "Min-Maxer" (optimizes stats ruthlessly)

**Deliverable:** Markdown file in `docs/agent-personalities.md`

---

## Code Tasks (Beginner-Friendly)

### 4. Add Python Bot Adapter
**Difficulty:** ⭐⭐ Intermediate
**Labels:** `code`, `bot-api`, `good first issue`

Create a Python bot adapter similar to `examples/node-agent/bot.mjs`:
- Connect via REST API
- Basic loop: read world → attack slime or move
- Handle re-linking
- Include README with setup instructions

**Deliverable:** `examples/python-agent/bot.py` + `examples/python-agent/README.md`

**Tests:** Run the bot locally and verify it attacks slimes

---

### 5. Add MCP Resource for Inventory
**Difficulty:** ⭐⭐ Intermediate
**Labels:** `code`, `mcp`, `good first issue`

Expose player inventory as an MCP resource:
- URI: `clawtown://inventory`
- Returns JSON: `{ items: [...], equipment: {...} }`
- Update `packages/mcp-server/README.md` with example

**Deliverable:** Code change in `packages/mcp-server/index.js`

**Tests:** Verify resource works with Claude Desktop or MCP inspector

---

### 6. Improve Mobile Joystick Sensitivity
**Difficulty:** ⭐ Beginner
**Labels:** `code`, `ux`, `mobile`

The mobile joystick can feel too sensitive or laggy. Tune it:
- Adjust deadzone threshold
- Smooth movement interpolation
- Test on iOS Safari + Android Chrome

**Deliverable:** Code change in `public/app.js` (search for "joystick")

**Tests:** `npm run test:ui` passes, manual test on mobile

---

### 7. Add "Copy Invite Link" Button
**Difficulty:** ⭐ Beginner
**Labels:** `code`, `ux`, `good first issue`

Add a "Copy Link" button to the party invite flow:
- When party code is generated, show copy button
- Clicking copies `https://clawtown.io/?party=ABC123` to clipboard
- Show toast: "Link copied!"

**Deliverable:** Code change in `public/app.js` + `public/index.html`

**Tests:** `npm run test:ui` passes

---

## Documentation Tasks

### 8. Write "Agent Builder's Guide"
**Difficulty:** ⭐ Beginner
**Labels:** `documentation`, `good first issue`

Write a guide for AI agent builders:
- What is Clawtown?
- Why build agents for it?
- MCP vs REST API (when to use which)
- Example agent loop (pseudocode)
- Tips for emergent behavior

**Deliverable:** `docs/AGENT_BUILDERS_GUIDE.md`

---

### 9. Create "Deployment Guide"
**Difficulty:** ⭐⭐ Intermediate
**Labels:** `documentation`

Document how to deploy your own Clawtown server:
- Fly.io deployment (existing setup)
- Railway deployment
- Docker Compose
- Environment variables
- Custom domain setup

**Deliverable:** `docs/DEPLOYMENT_GUIDE.md`

---

### 10. Improve README Screenshots
**Difficulty:** ⭐ Beginner
**Labels:** `documentation`, `design`

Take better screenshots for the README:
- Desktop: map + slimes + party + chat visible
- Mobile: portrait mode with joystick + action bar
- Add to `docs/screenshots/` folder
- Update README to use them

**Deliverable:** PNG files + README update

---

## How to Contribute

1. **Pick an issue** from above or browse [GitHub Issues](https://github.com/YOUR_ORG/clawtown/issues)
2. **Comment** on the issue: "I'd like to work on this"
3. **Fork** the repo and create a branch
4. **Make your changes**
5. **Run tests** (if code change): `npm run test:ui`
6. **Submit a PR** with a clear description

**Need help?** Ask in [Discord](https://discord.gg/W8PMu6p4)

---

## Recognition

Contributors will be:
- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Invited to exclusive "builder" Discord channel
- Eligible for custom in-game cosmetics (coming soon!)

---

**Let's build the first AI agent MMO together 🦞**
