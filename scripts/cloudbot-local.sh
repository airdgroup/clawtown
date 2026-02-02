#!/usr/bin/env bash
set -euo pipefail

# Clawtown CloudBot local loop
#
# 用法：
#   ./scripts/cloudbot-local.sh 'CT1|http://localhost:3000|ABC123'
#
# 說明：
# - 這個腳本會用 join token 取得 botToken，切到 H-Mode（agent），然後開始自動尋怪 + 打史萊姆（偏 RO 自動練功感）。
# - join code / bot token 都是短期有效；重啟 server 後需要重新拿 join token。

JOIN_TOKEN=${1:-}
if [ -z "${JOIN_TOKEN}" ]; then
  echo "請帶入 join token，例如：CT1|http://localhost:3000|ABC123" >&2
  exit 2
fi

IFS='|' read -r VERSION BASE_URL JOIN_CODE <<<"${JOIN_TOKEN}" || true
if [ "${VERSION}" != "CT1" ] || [ -z "${BASE_URL}" ] || [ -z "${JOIN_CODE}" ]; then
  echo "join token 格式錯誤。預期：CT1|<baseUrl>|<joinCode>" >&2
  exit 2
fi

LINK_RESP=$(curl -sS -X POST "${BASE_URL}/api/bot/link" \
  -H 'Content-Type: application/json' \
  -d "{\"joinToken\":\"${JOIN_TOKEN}\"}")

export LINK_RESP
BOT_TOKEN=$(python3 - <<'PY'
import os, json, sys
resp=json.loads(os.environ['LINK_RESP'])
if not resp.get('ok'):
  sys.exit(2)
tok=resp.get('botToken') or resp.get('token') or ''
tok=str(tok).strip()
if not tok:
  sys.exit(3)
print(tok)
PY
) || {
  echo "link 失敗：${LINK_RESP}" >&2
  exit 2
}

curl -sS -X POST "${BASE_URL}/api/bot/mode" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"agent"}' >/dev/null

# announce intent + bootstrap thought
curl -sS -X POST "${BASE_URL}/api/bot/intent" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"[BOT] Auto-grind: scan -> move -> cast (job skill)."}' >/dev/null || true

curl -sS -X POST "${BASE_URL}/api/bot/chat" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"[BOT] Linked. Switching to H-Mode and starting the hunt."}' >/dev/null || true

echo "已連線，開始行動" >&2

# roam points across the map (not just plaza)
ROAM_POINTS=(
  "520 300"  # plaza
  "730 430"  # pond area
  "160 120"  # northwest
  "840 120"  # northeast
  "150 500"  # southwest
  "860 500"  # southeast
)
roam_idx=0

last_thought_ms=0
last_key=""

while true; do
  WORLD=$(curl -sS "${BASE_URL}/api/bot/world" -H "Authorization: Bearer ${BOT_TOKEN}" || true)
  export WORLD

  ACTION_AND_THOUGHT=$(python3 - <<'PY'
import os,json,math,time
s=os.environ.get('WORLD','')
try:
  w=json.loads(s)
except Exception:
  print('wait|[BOT] world JSON parse failed; waiting...'); raise SystemExit

if not w.get('ok'):
  # unauthorized / server restarting
  print('wait|[BOT] world not ok; waiting...'); raise SystemExit

snap=w.get('snapshot') or {}
you=snap.get('you') or {}
mx,my=you.get('x'),you.get('y')
job=(you.get('job') or '').lower()
skill=(you.get('jobSkill') or {})
spell=(skill.get('spell') or '').lower() or 'signature'
skill_name=(skill.get('name') or 'Skill4').strip() or 'Skill4'

ranges={'signature':120,'flurry':120,'cleave':140,'arrow':260,'fireball':260,'hail':260}
attack_range=ranges.get(spell,120)
engage=max(24, attack_range-10)

mons=[m for m in (snap.get('monsters') or []) if isinstance(m,dict) and m.get('alive', True) and 'slime' in (m.get('kind') or m.get('type') or '').lower()]
if not mons or not isinstance(mx,(int,float)) or not isinstance(my,(int,float)):
  print(f'roam|[BOT] no slimes in snapshot; roam. job={job} skill4={skill_name}:{spell}')
  raise SystemExit

# pick nearest slime
def d2(m):
  x,y=m.get('x'),m.get('y')
  if not isinstance(x,(int,float)) or not isinstance(y,(int,float)):
    return 1e18
  dx=x-mx; dy=y-my
  return dx*dx+dy*dy

mons.sort(key=d2)
tgt=mons[0]
tx,ty=tgt.get('x'),tgt.get('y')
dist=math.sqrt(max(0,d2(tgt)))

# if too far, walk closer
if dist > engage:
  print(f'goal:{int(tx)}:{int(ty)}|[BOT] see {len(mons)} slimes. nearest={tgt.get("name")} dist={dist:.0f}. move in. skill4={skill_name}:{spell}')
  raise SystemExit

# cast decision
if spell in ('fireball','hail'):
  # aim at a small cluster
  pts=[m for m in mons[:6] if math.sqrt(max(0,d2(m))) < 240]
  if pts:
    cx=sum(m.get('x') for m in pts if isinstance(m.get('x'),(int,float))) / len(pts)
    cy=sum(m.get('y') for m in pts if isinstance(m.get('y'),(int,float))) / len(pts)
  else:
    cx,cy=tx,ty
  print(f'cast:job:{int(cx)}:{int(cy)}|[BOT] cast {skill_name}:{spell} @({int(cx)},{int(cy)})')
else:
  print(f'cast:job|[BOT] cast {skill_name}:{spell} (range {attack_range})')
PY
  )

  ACTION=${ACTION_AND_THOUGHT%%|*}
  THOUGHT=${ACTION_AND_THOUGHT#*|}
  if [ "$ACTION" = "$ACTION_AND_THOUGHT" ]; then THOUGHT=""; fi

  # throttle thoughts unless decision changes
  now_ms=$(python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
)
  key="$ACTION"
  if [ -n "$THOUGHT" ] && { [ "$key" != "$last_key" ] || [ $((now_ms - last_thought_ms)) -ge 2600 ]; }; then
    last_key="$key"
    last_thought_ms=$now_ms
    curl -sS -X POST "${BASE_URL}/api/bot/chat" -H "Authorization: Bearer ${BOT_TOKEN}" -H 'Content-Type: application/json' -d "{\"text\":\"${THOUGHT//\"/\\\"}\"}" >/dev/null || true
  fi

  if [[ "${ACTION}" == roam* ]]; then
    xy=${ROAM_POINTS[$roam_idx]}
    x=${xy%% *}
    y=${xy##* }
    roam_idx=$(( (roam_idx + 1) % ${#ROAM_POINTS[@]} ))
    curl -sS -X POST "${BASE_URL}/api/bot/goal" -H "Authorization: Bearer ${BOT_TOKEN}" -H 'Content-Type: application/json' -d "{\"x\":${x},\"y\":${y}}" >/dev/null || true
  elif [[ "${ACTION}" == goal:* ]]; then
    IFS=':' read -r _ gx gy <<<"${ACTION}"
    curl -sS -X POST "${BASE_URL}/api/bot/goal" -H "Authorization: Bearer ${BOT_TOKEN}" -H 'Content-Type: application/json' -d "{\"x\":${gx},\"y\":${gy}}" >/dev/null || true
  elif [[ "${ACTION}" == cast:*:*:* ]]; then
    IFS=':' read -r _ sp cx cy <<<"${ACTION}"
    curl -sS -X POST "${BASE_URL}/api/bot/cast" -H "Authorization: Bearer ${BOT_TOKEN}" -H 'Content-Type: application/json' -d "{\"spell\":\"${sp}\",\"x\":${cx},\"y\":${cy}}" >/dev/null || true
  elif [[ "${ACTION}" == cast:* ]]; then
    IFS=':' read -r _ sp <<<"${ACTION}"
    curl -sS -X POST "${BASE_URL}/api/bot/cast" -H "Authorization: Bearer ${BOT_TOKEN}" -H 'Content-Type: application/json' -d "{\"spell\":\"${sp}\"}" >/dev/null || true
  else
    :
  fi

  python3 - <<'PY'
import random,time
time.sleep(1.0 + random.random()*0.7)
PY
done
