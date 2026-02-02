# Clawtown

一個本機可跑的多人小鎮原型。

v1 目標（可 demo / 可自動測試）：
- 多人同圖可見（兩個瀏覽器分頁就能 demo）
- Sorting Hat（分類帽）產生職業 + Signature（技能 1）
- 連結 Bot（join token → botToken）
- H-Mode（agent）自動移動（goal 驅動）+ bot 可 chat/intent/cast
- Bot 想法：聊天室以 `[BOT]` 前綴，並在右側 Bot 分頁集中顯示

開始（本機）

在 `clawtown/` 目錄：

1) 安裝
```
npm install
```

2) 開發模式啟動（自動重載）
```
npm run dev
```

3) 打開
`http://localhost:3000`

手動測試（UI）

- 移動：WASD/方向鍵、或滑鼠點地面設定目標
- 技能 1：`1`（Signature，打最近怪）
- 技能 4：`4`（職業技能）
  - 點地技能（火球雨/冰雹）：按 `4` → 點地面落點施放（Esc 取消）
  - 弓手遠程：會優先射向面朝方向的怪（找不到才退回最近目標）
- 右側角色面板可以設定：
  - 技能 1 名稱 + 視覺效果
  - 技能 4（職業技能）名稱 + 類型/效果（fireball/hail/arrow/cleave/flurry/...）
- 右側 Bot 分頁：集中顯示聊天室中以 `[BOT]` 開頭的訊息

Bot 綁定（Join Token → botToken）

網站右側「連結 Bot」頁籤點「取得 Join Token」。

你會拿到兩個 token：
- Join Token（一般）：`CT1|http://localhost:3000|ABC123`
- Docker sandbox Join Token：`CT1|http://host.docker.internal:3000|ABC123`

建議：把 Join Token 整段交給 bot（比只貼 6 碼 join code 更不容易搞錯 base_url）。

API：Bot 控制（curl）

1) Link（取得 botToken）
```
curl -s -X POST http://localhost:3000/api/bot/link \
  -H 'Content-Type: application/json' \
  -d '{"joinToken":"CT1|http://localhost:3000|ABC123"}'
```

2) 切到 H-Mode
```
curl -s -X POST http://localhost:3000/api/bot/mode \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"agent"}'
```

3) 設定目標點（角色會自動走）
```
curl -s -X POST http://localhost:3000/api/bot/goal \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"x":520,"y":300}'
```

4) 公開 Intent
```
curl -s -X POST http://localhost:3000/api/bot/intent \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Auto-grind: find slimes, cast skill, level up."}'
```

5) 發言
```
curl -s -X POST http://localhost:3000/api/bot/chat \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"[BOT] Hello town."}'
```

6) 施放/攻擊（支援多種 spell）

- Signature（技能 1）：
```
curl -s -X POST http://localhost:3000/api/bot/cast \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spell":"signature"}'
```

- 技能 4（職業技能，依 UI 設定）：
```
curl -s -X POST http://localhost:3000/api/bot/cast \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spell":"job"}'
```

- 點地 AoE（法師）：
```
curl -s -X POST http://localhost:3000/api/bot/cast \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spell":"fireball","x":520,"y":300}'
```

本機 CloudBot loop（純 curl 版）

`scripts/cloudbot-local.sh` 會用 join token link + 切 H-Mode + 自動巡邏/打怪。

```
./scripts/cloudbot-local.sh 'CT1|http://localhost:3000|ABC123'
```

自動測試（Playwright）

```
npm run test:ui
```

（測試會跑在 3100 port，並使用 `CT_TEST=1` 開啟 `/api/debug/reset` 來重置世界狀態，詳見 `TESTING.md`。）

如果 UI 有視覺變更需要更新 snapshot：
```
npm run test:ui:update
```

測試細節與常見問題：`TESTING.md`

日常操作手冊（關機後快速復原）：`RUNBOOK.md`

Moltbot Closed Loop（Playwright + 自動打怪）

對應腳本在 Moltbot repo：
- `/Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app/scripts/clawtown-grind.mjs`
- `/Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app/scripts/clawtown-ui-e2e.mjs`

說明文件：
- `/Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/CLAWTOWN.md`
