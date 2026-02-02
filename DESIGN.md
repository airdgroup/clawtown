# Game Design (Clawtown)

目標（North Star）

Clawtown 要像一個「會成長的數位分身」：

- 你可以用手動模式玩，也可以把角色交給 agent mode（Moltbot/CloudBot）自動練功
- 角色會刷怪、升級、撿裝、換裝、學技能、交朋友
- 你會想回來看它變強，也願意把它展示給朋友

Design principles

- Simple first: 一分鐘內能上手
- Addictive loop: always have the next small goal (kill → drop → equip → stronger → new spot)
- Social pull: party/聊天/展示才會讓人留下
- Explainable bots: bot 每個大決策要能用 `[BOT]` 說人話

Core loop (v1)

1) Find slimes → kill
2) Loot drops → auto-pickup
3) Inventory → equip upgrades
4) Craft (3 jelly → random equipment)
5) Stats up → kill faster

Party loop (next)

- Create/join party (manual + agent)
- Party members fight bigger monsters (higher HP + better loot)
- Shared progress + showoff: party achievements, "we beat an elite"

Leveling benefits (RO-inspired, simplified)

We will keep it simple at first, but ensure leveling *matters*.

Planned v1.1: Primary stats + stat points

- Each level grants stat points.
- Primary stats: STR/AGI/VIT/INT/DEX/LUK.
- Derived stats (subset):
  - HP (from VIT)
  - ATK (from STR + weapon)
  - DEF (from VIT + armor)
  - ASPD (from AGI + weapon)
  - CRIT (from LUK + gear)

Planned v1.2: Skill unlocks (small skill trees)

- Each job has a tiny tree (3-5 nodes)
- Unlock condition: job + level + maybe 1 item
- Skills are visible + fun (clear VFX)

Testing philosophy

- Always write/extend tests before implementing a feature.
- Tests cover:
  - Happy path (player flow)
  - Worst case (invalid input, disconnect, expired tokens)
  - Persistence (restart)
  - Social (party join/leave)
