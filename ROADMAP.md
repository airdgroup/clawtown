# Roadmap (Clawtown)

This file is the single place to track what’s done, what’s next, and what tests prove it.

North Star

Build a “digital twin” (RO-like): a character that can be played manually or autonomously (agent mode), grinding monsters, leveling up, looting gear, crafting upgrades, learning skills, and socializing (party/trade/showoff). It should be simple to learn and hard to stop.

Quality Gates (must stay green)

1) Clawtown UI tests
- `cd /Users/hejianzhi/Namecard/github/clawtown && npm run test:ui`

2) Moltbot closed-loop E2E (3x)
- See `/Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/CLAWTOWN.md`

3) Soak (10 minutes grinder)
- See `/Users/hejianzhi/Namecard/github/clawtown/RUNBOOK.md`

Done (v1 shipped)

- Loot drops + auto-pickup
- Inventory + equipment UI (backpack tab)
- Crafting v1 (3 jelly -> random equipment)
- Persistence v1 (xp/level/zenny/inventory/equipment)
- Bot auto-equip v1 (+ [BOT] explanation)
- Achievements v1 (kills/crafts/pickups)

Proving tests

- `Loot: defeating a monster drops loot and auto-picks it up`
- `Inventory: equipping a weapon updates stats`
- `Crafting: 3 jelly crafts a random equipment`
- `Bot: auto-equips better weapon on pickup`
- `Persistence: inventory/equipment survives restart (CT_TEST)`
- `Achievements: kill counter increases`

Next (highest leverage)

1) Party (social + harder content)

- Party create/join/leave
- Party member list (manual + agent together)
- Shared XP on kills (nearby)
- Party can fight “elite” monsters with better loot

Planned tests

- Party create/join via UI; both sides see each other
- Shared XP on elite kill for both members
- Invalid/expired invite code

2) Leveling benefits (RO-inspired, simplified)

- Stat points on level up
- Primary stats: STR/AGI/VIT/INT/DEX/LUK
- Derived: HP/ATK/DEF/ASPD/CRIT

Planned tests

- Allocate stat points -> derived stats change
- Higher ATK -> faster kill (time/number of casts)

3) Skills (tiny job trees)

- 3-5 unlocks per job
- Clear VFX + cooldowns

4) Reliability

- Token expiry self-recovery
- Server restart recovery in E2E
- Anti prompt-injection in chat
