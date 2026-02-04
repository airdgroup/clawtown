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

v1.1（已做在 feat/stats-v1）：Primary stats + stat points

- Each level grants stat points.
- Primary stats: STR/AGI/VIT/INT/DEX/LUK.
- Derived stats (subset):
  - HP (from VIT)
  - ATK (from STR + weapon)
  - DEF (from VIT + armor)
  - ASPD (from AGI + weapon)
  - CRIT (from LUK + gear)

下一步：簡化屬性（降低學習成本）

- 目前 6 個屬性對一般玩家可能太重。
- 預計改成 2-3 個高訊號屬性（例如 Power / Toughness / Speed），其他都變成衍生值或職業自動分配。
- 原則：一眼看懂、按下去立刻有感、仍保留 RO-like 成長節奏。

UX 原則（近期重點）

- 左側地圖/技能列固定：玩家在右側看角色資訊時仍能一直看到戰鬥畫面。
- Bot 連結要跨渠道：Telegram/WhatsApp/WebChat 都應該只要貼 join token（或點 deep link）就能完成連結；不要要求玩家理解 curl。

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
