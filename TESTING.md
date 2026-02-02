# Testing (Clawtown)

這份文件描述 Clawtown 的測試策略與常見問題（人類與 AI 都適用）。

快速開始

- 跑全部 UI tests（Playwright）：
  - `npm run test:ui`

- 更新 UI snapshots（只有 UI 有預期變更才做）：
  - `npm run test:ui:update`

測試架構

- 測試框架：Playwright（見 `playwright.config.ts`）
- 測試目錄：`tests/`
- webServer：測試時會自動用 `node server/index.js` 起一個 server
  - port：3100
  - health：`http://127.0.0.1:3100/api/health`

測試專用功能（CT_TEST）

- Playwright run 時會設定 `CT_TEST=1`
- 當 `CT_TEST=1`：server 會開一個 debug endpoint：
  - `POST /api/debug/reset`
  - 用途：每個 test 開始前把 world state 重置，避免 test 互相污染

常見問題

1) Port 3100 被佔用
- Playwright 會報：`.../api/health is already used`
- 解法：先把佔用 port 3100 的 process 停掉，再 rerun
  - 查：`lsof -nP -iTCP:3100 -sTCP:LISTEN`
  - 停：`kill <pid>`

2) UI tests 偶發 flaky
- 原因通常是 world state 沒 reset 或 monster wandering
- 原則：
  - 優先做 deterministic setup（例如用 bot API 先把角色移到怪旁邊）
  - 每個 test 前先呼叫 `/api/debug/reset`
