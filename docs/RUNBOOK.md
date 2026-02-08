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

Quality Gates（推薦每次 milestone 都跑）

1) Clawtown UI tests

```bash
cd /Users/hejianzhi/Namecard/github/clawtown
npm run test:ui
```

2) Closed-loop E2E（連跑 3 次）

```bash
for i in 1 2 3; do
  echo "--- e2e $i ---"
  docker exec -w /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app moltbot-sandbox bash -lc '
    export FNM_PATH="/home/agent/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm use 22 &&
    export MOLTBOT_STATE_DIR="/home/agent/.moltbot" &&
    node ./scripts/clawtown-ui-e2e.mjs --baseUrl http://host.docker.internal:3000 --name MoltbotE2E --runForMs 20000
  '
done
```

3) Soak（10 分鐘 grinder）

```bash
docker exec -w /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app moltbot-sandbox bash -lc '
  export FNM_PATH="/home/agent/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env)" && fnm use 22 &&
  export MOLTBOT_STATE_DIR="/home/agent/.moltbot" &&
  node ./scripts/clawtown-grind.mjs --baseUrl http://host.docker.internal:3000 --name MoltbotSoak --runForMs 600000
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

- Join code 會存到 `.data/join_codes.json`（24h TTL），server 重啟後通常仍可用。
- botToken 會存到 `.data/bot_tokens.json`，server 重啟後通常仍可用。
- 解法：
  - 直接用同一個 join token 再打一次 `POST /api/bot/link`（會回新的 botToken），再繼續呼叫 `/api/bot/status/world/...`。
  - 或用 UI 重新「取得 Join Token」。
  - 或用 Moltbot E2E 自動取得 join token + link。

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

補充：如果你只有 Clawtown repo（沒有 Moltbot repo）

1) 先用 UI 產生 Join Token
- 右側「連結 Bot」→「取得 Join Token」

2) 跑本 repo 內的純 curl loop

```bash
cd /Users/hejianzhi/Namecard/github/clawtown
./scripts/cloudbot-local.sh 'CT1|http://localhost:3000|ABC123'
```

3) 看「寵物回報」（events/status + map.png）

```bash
cd /Users/hejianzhi/Namecard/github/clawtown
node ./scripts/cloudbot-digest.mjs 'CT1|http://localhost:3000|ABC123' --pollMs 3000 --runForMs 30000 --outDir /tmp/clawtown --mapEveryMs 10000
```

部署提醒（自訂網域）

- 如果你把 Clawtown 部署到 `https://clawtown.io`，建議在 server 環境變數設定：
  - `CT_PUBLIC_BASE_URL=https://clawtown.io`
  - 這樣 UI 產生的 Join Token 會固定用公開網域（而不是內部 host / proxy host）。

補充：如果你有 Moltbot repo 但 Docker Desktop 沒開

- 仍可在 host 直接跑 closed-loop（不經 sandbox）：

```bash
node /Users/hejianzhi/Namecard/nai/sandbox-projects/moltbot/app/scripts/clawtown-ui-e2e.mjs --baseUrl http://localhost:3000 --name MoltbotE2E --runForMs 20000
```
