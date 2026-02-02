# Runbook (Clawtown)

這份文件是「關機/關掉 terminal 之後」回來能最快復現的操作手冊（人類與 AI agent 都適用）。

日常開發流程（最短路徑）

1) 啟動 Clawtown（host）

```bash
cd /Users/hejianzhi/Namecard/github/clawtown
npm run dev
```

2) 跑 Clawtown 測試（host）

```bash
cd /Users/hejianzhi/Namecard/github/clawtown
npm run test:ui
```

3) 跑 Moltbot closed-loop E2E（sandbox）

```bash
docker start moltbot-sandbox 2>/dev/null || true
docker exec -w /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app moltbot-sandbox bash -lc '
  export FNM_PATH="/home/agent/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm use 22 &&
  export MOLTBOT_STATE_DIR="/home/agent/.moltbot" &&
  node ./scripts/clawtown-ui-e2e.mjs --baseUrl http://host.docker.internal:3000 --name MoltbotE2E --runForMs 20000
'
```

如果 docker 指令失敗（docker.sock / daemon error）

- 先打開 Docker Desktop，等它 Running
- 再重跑上面那段

4) 失敗時先看這些 log

- sandbox：
  - `/home/agent/.moltbot/clawtown-ui-e2e.log`
  - `/home/agent/.moltbot/clawtown-moltbot.log`
- Clawtown Playwright：
  - `clawtown/test-results/`

常見救援

1) Playwright 測試卡住 / port 3100 被佔用

```bash
lsof -nP -iTCP:3100 -sTCP:LISTEN
kill <pid>
```

2) join code / botToken 失效

- v1 是 in-memory：server 重啟後 join code / token 會失效。
- 解法：用 UI 重新「取得 Join Token」，或用 Moltbot E2E 自動取得。

3) 我只想快速驗證 bot 真的會打怪

```bash
docker exec -w /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app moltbot-sandbox bash -lc '
  export FNM_PATH="/home/agent/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm use 22 &&
  export MOLTBOT_STATE_DIR="/home/agent/.moltbot" &&
  node ./scripts/clawtown-grind.mjs --baseUrl http://host.docker.internal:3000 --runForMs 20000
'
```

測試細節

請看：`TESTING.md`
