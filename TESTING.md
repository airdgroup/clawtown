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

近期新增的關鍵回歸測試（防止「看起來很小」但很致命的 bug）

- `VFX: future-dated FX does not crash canvas (no negative radius)`
  - 目的：避免 client/server clock skew 造成 FX 半徑為負、canvas draw throw，導致畫面閃爍或整張不更新。
- `Coach: first kill celebration shows a single toast (no flashing)`
  - 目的：確保新手 Aha moment（首殺）不會用閃爍干擾玩家。
- `Avatar: background removal makes corner pixels transparent (beta)`
  - 目的：避免使用者上傳「棋盤格假透明」時，邊角無法被處理。

測試專用功能（CT_TEST）

- Playwright run 時會設定 `CT_TEST=1`
- 當 `CT_TEST=1`：server 會開一個 debug endpoint：
  - `POST /api/debug/reset`
  - 用途：每個 test 開始前把 world state 重置，避免 test 互相污染

另外也會提供：
- `POST /api/debug/persist-flush`：強制把玩家資料寫到 disk
- `POST /api/debug/restart-sim`：模擬 server 重啟（保留 disk 資料）

以及 deterministic setup 用的 helpers：

- `POST /api/debug/teleport`：把玩家移到指定座標
- `POST /api/debug/spawn-monster`：在指定座標生成怪（支援 `color` 欄位，方便做視覺測試）
- `POST /api/debug/grant-item`：直接給玩家物品

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

3) Snapshot 測試失敗（UI baseline looks polished）

- 代表 UI 有預期變更（或 font/尺寸微變）
- 更新 snapshot：`npm run test:ui:update`
