/* global WebSocket, fetch, localStorage */

const statusEl = document.getElementById("status");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Temporary avatar sprite (can be replaced with better skins later)
const avatarSprite = new Image();
avatarSprite.src = "/assets/poring_mount_alpha.png";
let avatarSpriteReady = false;
avatarSprite.onload = () => {
  avatarSpriteReady = true;
};

const hudNameEl = document.getElementById("hudName");
const hudJobEl = document.getElementById("hudJob");
const hudLevelEl = document.getElementById("hudLevel");
const hudModeEl = document.getElementById("hudMode");
const hudBotEl = document.getElementById("hudBot");

const nameInput = document.getElementById("name");
const jobEl = document.getElementById("job");
const levelEl = document.getElementById("level");
const modeManualBtn = document.getElementById("modeManual");
const modeAgentBtn = document.getElementById("modeAgent");
const killsEl = document.getElementById("kills");
const craftsEl = document.getElementById("crafts");
const pickupsEl = document.getElementById("pickups");
const achievementsEl = document.getElementById("achievements");

const partyCreateBtn = document.getElementById("partyCreate");
const partyLeaveBtn = document.getElementById("partyLeave");
const partyCodeInput = document.getElementById("partyCode");
const partyMakeCodeBtn = document.getElementById("partyMakeCode");
const partyJoinCodeInput = document.getElementById("partyJoinCode");
const partyJoinBtn = document.getElementById("partyJoin");
const partyMembersEl = document.getElementById("partyMembers");
const partySummonBtn = document.getElementById("partySummon");
const intentInput = document.getElementById("intent");
const saveIntentBtn = document.getElementById("saveIntent");
const castBtn = document.getElementById("cast");

const hatResultEl = document.getElementById("hatResult");
const hatLogEl = document.getElementById("hatLog");
const hatOptionsEl = document.getElementById("hatOptions");
const hatFreeWrap = document.getElementById("hatFreeWrap");
const hatFreeInput = document.getElementById("hatFreeInput");
const hatFreeSend = document.getElementById("hatFreeSend");
const hatFreeSkip = document.getElementById("hatFreeSkip");
const hatRestart = document.getElementById("hatRestart");
const hatCheck = document.getElementById("hatCheck");
const hatLink = document.getElementById("hatLink");

const slot1 = document.getElementById("slot1");
const slot2 = document.getElementById("slot2");
const slot3 = document.getElementById("slot3");
const slot4 = document.getElementById("slot4");
const slot1Name = document.getElementById("slot1Name");
const slot4Name = document.getElementById("slot4Name");
const makeJoinCodeBtn = document.getElementById("makeJoinCode");
const joinCodeEl = document.getElementById("joinCode");
const joinTokenEl = document.getElementById("joinToken");
const sandboxJoinTokenEl = document.getElementById("sandboxJoinToken");
const copyJoinTokenBtn = document.getElementById("copyJoinToken");
const copySandboxJoinTokenBtn = document.getElementById("copySandboxJoinToken");

const botPromptEl = document.getElementById("botPrompt");
const copyBotPromptBtn = document.getElementById("copyBotPrompt");
const copyBotPromptDockerBtn = document.getElementById("copyBotPromptDocker");

const skill1NameEl = document.getElementById("skill1Name");
const skill1EffectEl = document.getElementById("skill1Effect");
const saveSkill1Btn = document.getElementById("saveSkill1");
const resetSkill1Btn = document.getElementById("resetSkill1");

const skill4NameEl = document.getElementById("skill4Name");
const skill4SpellEl = document.getElementById("skill4Spell");
const saveSkill4Btn = document.getElementById("saveSkill4");
const resetSkill4Btn = document.getElementById("resetSkill4");

const boardEl = document.getElementById("board");
const boardInput = document.getElementById("boardInput");
const boardSend = document.getElementById("boardSend");
const chatEl = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

const botLogEl = document.getElementById("botLog");

const inventoryEl = document.getElementById("inventory");
const zennyEl = document.getElementById("zenny");
const atkEl = document.getElementById("atk");
const defEl = document.getElementById("def");
const equipWeaponEl = document.getElementById("equipWeapon");
const equipArmorEl = document.getElementById("equipArmor");
const equipAccessoryEl = document.getElementById("equipAccessory");

const craftJellyBtn = document.getElementById("craftJelly");
const craftJellyHintBtn = document.getElementById("craftJellyHint");

const onboardingEl = document.getElementById("onboarding");
const onboardingStart = document.getElementById("onboardingStart");
const onboardingGoHat = document.getElementById("onboardingGoHat");

const tabButtons = Array.from(document.querySelectorAll(".ui-tab"));
const tabPanels = Array.from(document.querySelectorAll(".tab"));

function uid() {
  return "p_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

const STORAGE_KEY = "clawtown.player";
const stored = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
})();

const playerId = stored?.playerId || uid();
let myName = stored?.name || "";
let ws;
let state;
let you;
let recentFx = [];
let lastMoveSentAt = 0;
let keyState = { up: false, down: false, left: false, right: false };

let pendingTarget = null; // { spell }
let pendingTargetUntilMs = 0;

const localLastSpeech = new Map(); // playerId -> { text, atMs }

function openTab(tabKey) {
  for (const b of tabButtons) {
    const is = b.dataset.tab === tabKey;
    b.classList.toggle("is-active", is);
    b.setAttribute("aria-selected", is ? "true" : "false");
  }
  for (const p of tabPanels) {
    p.classList.toggle("is-active", p.dataset.tab === tabKey);
  }

  if (tabKey === "hat") {
    hatStartIfNeeded();
  }
}

for (const b of tabButtons) {
  b.addEventListener("click", () => openTab(b.dataset.tab));
}

openTab("character");

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerId, name: myName }));
}

nameInput.value = myName;
nameInput.addEventListener("change", () => {
  myName = String(nameInput.value || "").trim().slice(0, 24);
  persist();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_name", name: myName }));
  }
  ensurePlayer();
});

async function ensurePlayer() {
  const res = await fetch("/api/players/ensure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, name: myName }),
  });
  const data = await res.json();
  if (data?.ok) {
    you = data.player;
    renderHeader();
  }
}

function setMode(mode) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "set_mode", mode }));
}

function jobSkillFor(job) {
  // Prefer the user-configured Skill 4 on the player.
  const cfg = you && you.jobSkill;
  const spell = String((cfg && cfg.spell) || "").trim() || "";
  const name = String((cfg && cfg.name) || "").trim() || "";

  if (spell) {
    const needsTarget = spell === "fireball" || spell === "hail";
    return { spell, name: name || "職業技", needsTarget };
  }

  const j = String(job || "").toLowerCase();
  if (j === "mage") return { spell: "fireball", name: "火球雨", needsTarget: true };
  if (j === "archer") return { spell: "arrow", name: "遠程射擊", needsTarget: false };
  if (j === "knight") return { spell: "cleave", name: "橫掃", needsTarget: false };
  if (j === "assassin") return { spell: "flurry", name: "疾刺", needsTarget: false };
  if (j === "bard") return { spell: "signature", name: "回音彈", needsTarget: false };
  return { spell: "signature", name: "練習斬", needsTarget: false };
}

function castSpell(spell, x, y) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const msg = { type: "cast", spell };
  if (Number.isFinite(x) && Number.isFinite(y)) {
    msg.x = x;
    msg.y = y;
  }
  ws.send(JSON.stringify(msg));
}

modeManualBtn.addEventListener("click", () => setMode("manual"));
modeAgentBtn.addEventListener("click", () => setMode("agent"));

saveIntentBtn.addEventListener("click", () => {
  const text = String(intentInput.value || "").trim();
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "set_intent", text }));
});

castBtn.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "cast" }));
});

saveSkill1Btn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const name = String(skill1NameEl?.value || "").trim().slice(0, 48);
  const effect = String(skill1EffectEl?.value || "spark").trim();
  ws.send(JSON.stringify({ type: "set_signature", name, effect }));
  if (slot1Name) slot1Name.textContent = name || "技能1";
});

resetSkill1Btn?.addEventListener("click", () => {
  if (!you) return;
  if (skill1NameEl) skill1NameEl.value = you.signatureSpell?.name || "";
  if (skill1EffectEl) skill1EffectEl.value = you.signatureSpell?.effect || "spark";
});

slot1?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "cast" }));
});

slot2?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "emote", emote: "wave" }));
});

slot3?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "ping" }));
});

slot4?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!you) return;
  const sk = jobSkillFor(you.job);
  if (sk.needsTarget) {
    pendingTarget = { spell: sk.spell };
    pendingTargetUntilMs = Date.now() + 6000;
    statusEl.textContent = `點地面施放：${sk.name}（Esc 取消）`;
    return;
  }
  castSpell(sk.spell);
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "1") slot1?.click();
  if (e.key === "2") slot2?.click();
  if (e.key === "3") slot3?.click();
  if (e.key === "4") slot4?.click();
  if (e.key === "Escape") {
    if (pendingTarget) {
      pendingTarget = null;
      pendingTargetUntilMs = 0;
      statusEl.textContent = ws && ws.readyState === WebSocket.OPEN ? "已連線" : "連線中...";
    }
  }
});

async function refreshHat() {
  const res = await fetch(`/api/hat/result?playerId=${encodeURIComponent(playerId)}`);
  const data = await res.json();
  if (!data?.ok) return;
  const r = data.result;
  if (!r) {
    hatResultEl.textContent = "Answer the questions to reveal your path.";
    return;
  }
  const title = data.source === "bot" ? "CloudBot 精煉" : "分類帽";
  const reasons = Array.isArray(r.reasons) ? r.reasons : [];
  const sig = r.signature || {};
  hatResultEl.innerHTML = `
    <div><b>${title}</b>：你偏向 <b>${escapeHtml(r.job)}</b>。</div>
    <div style="margin-top:6px;color:rgba(19,27,42,0.72)">${reasons.map((x) => `- ${escapeHtml(x)}`).join("<br/>")}</div>
    <div style="margin-top:8px"><span style="color:rgba(19,27,42,0.68)">專屬招式：</span> <b>${escapeHtml(sig.name || "")}</b></div>
    <div style="margin-top:4px;color:rgba(19,27,42,0.68)">${escapeHtml(sig.tagline || "")}</div>
  `;
}

let hatState = {
  step: 0,
  busy: false,
  answers: {
    goal: null,
    conflict: null,
    magic: null,
    free: "",
  },
};

function hatClear() {
  if (hatLogEl) hatLogEl.innerHTML = "";
  if (hatOptionsEl) hatOptionsEl.innerHTML = "";
  hatFreeWrap?.classList.remove("is-active");
  if (hatFreeInput) hatFreeInput.value = "";
  hatState = {
    step: 0,
    busy: false,
    answers: { goal: null, conflict: null, magic: null, free: "" },
  };
  if (hatResultEl) hatResultEl.innerHTML = "";
}

function hatAppend(who, text) {
  if (!hatLogEl) return;
  const turn = document.createElement("div");
  turn.className = "hat-turn";
  const a = document.createElement("div");
  a.className = "hat-who";
  a.textContent = who;
  const b = document.createElement("div");
  b.className = "hat-said";
  b.textContent = text;
  turn.appendChild(a);
  turn.appendChild(b);
  hatLogEl.appendChild(turn);
  hatLogEl.scrollTop = hatLogEl.scrollHeight;
}

function hatSetOptions(options) {
  if (!hatOptionsEl) return;
  hatOptionsEl.innerHTML = "";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "hat-choice";
    btn.type = "button";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => opt.onPick());
    hatOptionsEl.appendChild(btn);
  }
}

async function hatThink(ms) {
  hatState.busy = true;
  hatSetOptions([]);
  await new Promise((r) => setTimeout(r, ms));
  hatState.busy = false;
}

async function hatAskNext() {
  if (hatState.busy) return;

  if (hatState.step === 0) {
    hatAppend("帽子", "來吧，旅人。先告訴我：你最想在這個世界做什麼？");
    hatSetOptions([
      {
        label: "戰鬥",
        onPick: async () => {
          hatAppend("你", "戰鬥");
          hatState.answers.goal = "combat";
          hatState.step = 1;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "探索",
        onPick: async () => {
          hatAppend("你", "探索");
          hatState.answers.goal = "explore";
          hatState.step = 1;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "社交",
        onPick: async () => {
          hatAppend("你", "社交");
          hatState.answers.goal = "social";
          hatState.step = 1;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "建造",
        onPick: async () => {
          hatAppend("你", "建造");
          hatState.answers.goal = "build";
          hatState.step = 1;
          await hatThink(350);
          await hatAskNext();
        },
      },
    ]);
    return;
  }

  if (hatState.step === 1) {
    hatAppend("帽子", "當衝突找上門，你的第一反應是？");
    hatSetOptions([
      {
        label: "正面上",
        onPick: async () => {
          hatAppend("你", "正面上");
          hatState.answers.conflict = "direct";
          hatState.step = 2;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "先想策略",
        onPick: async () => {
          hatAppend("你", "先想策略");
          hatState.answers.conflict = "strategy";
          hatState.step = 2;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "先理解對方",
        onPick: async () => {
          hatAppend("你", "先理解對方");
          hatState.answers.conflict = "empathy";
          hatState.step = 2;
          await hatThink(350);
          await hatAskNext();
        },
      },
    ]);
    return;
  }

  if (hatState.step === 2) {
    hatAppend("帽子", "你的魔法，感覺更像什麼？");
    hatSetOptions([
      {
        label: "力量",
        onPick: async () => {
          hatAppend("你", "力量");
          hatState.answers.magic = "power";
          hatState.step = 3;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "智慧",
        onPick: async () => {
          hatAppend("你", "智慧");
          hatState.answers.magic = "wisdom";
          hatState.step = 3;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "速度",
        onPick: async () => {
          hatAppend("你", "速度");
          hatState.answers.magic = "speed";
          hatState.step = 3;
          await hatThink(350);
          await hatAskNext();
        },
      },
      {
        label: "守護",
        onPick: async () => {
          hatAppend("你", "守護");
          hatState.answers.magic = "guard";
          hatState.step = 3;
          await hatThink(350);
          await hatAskNext();
        },
      },
    ]);
    return;
  }

  if (hatState.step === 3) {
    hatAppend("帽子", "最後一句：用一行話描述你（可略過）。");
    hatFreeWrap?.classList.add("is-active");
    hatSetOptions([]);
    hatFreeInput?.focus();
  }
}

async function hatSubmitAnswers() {
  await ensurePlayer();
  const answers = {
    goal: hatState.answers.goal,
    conflict: hatState.answers.conflict,
    magic: hatState.answers.magic,
    free: hatState.answers.free,
  };

  const res = await fetch("/api/hat/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, answers }),
  });
  const data = await res.json();
  if (!data?.ok) {
    hatAppend("帽子", "嗯…風向不太對。再試一次。 ");
    if (hatResultEl) hatResultEl.textContent = data?.error || "Failed";
    return;
  }
  await refreshHat();
}

function hatStartIfNeeded() {
  if (!hatLogEl || !hatOptionsEl) return;
  if (hatLogEl.childElementCount > 0) return;
  hatClear();
  hatAppend("帽子", "把我戴上吧。我會替你挑一條路。 ");
  hatAppend("帽子", "回答直覺一點，你會得到職業與專屬招式。 ");
  hatAskNext();
}

hatRestart?.addEventListener("click", () => {
  hatClear();
  hatStartIfNeeded();
});

hatCheck?.addEventListener("click", async () => {
  await refreshHat();
});

hatLink?.addEventListener("click", () => {
  openTab("link");
});

hatFreeSend?.addEventListener("click", async () => {
  hatState.answers.free = String(hatFreeInput?.value || "").trim().slice(0, 240);
  if (hatState.answers.free) hatAppend("你", hatState.answers.free);
  else hatAppend("你", "（沉默）");
  hatFreeWrap?.classList.remove("is-active");
  hatAppend("帽子", "很好。讓我看看…");
  await hatThink(450);
  await hatSubmitAnswers();
});

hatFreeSkip?.addEventListener("click", async () => {
  hatState.answers.free = "";
  hatAppend("你", "略過");
  hatFreeWrap?.classList.remove("is-active");
  hatAppend("帽子", "很好。讓我看看…");
  await hatThink(450);
  await hatSubmitAnswers();
});

makeJoinCodeBtn.addEventListener("click", async () => {
  await ensurePlayer();
  const res = await fetch("/api/join-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  const data = await res.json();
  if (!data?.ok) {
    joinCodeEl.textContent = "ERROR";
    return;
  }
  joinCodeEl.textContent = data.joinCode;
  if (hudBotEl) hudBotEl.textContent = "Bot：等待加入";
  if (joinTokenEl) joinTokenEl.value = data.joinToken || "";
  if (sandboxJoinTokenEl) sandboxJoinTokenEl.value = data.sandboxJoinToken || "";
  if (botPromptEl) botPromptEl.value = buildBotPrompt(joinTokenEl?.value || "");
  try {
    await navigator.clipboard.writeText(data.joinCode);
  } catch {
    // ignore
  }
});

async function copyText(text) {
  const s = String(text || "").trim();
  if (!s) return;
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    // ignore
  }
}

function parseJoinToken(joinToken) {
  const raw = String(joinToken || "").trim();
  const parts = raw.split("|");
  if (parts.length !== 3) return null;
  const version = parts[0].trim();
  const baseUrl = parts[1].trim();
  const joinCode = parts[2].trim();
  if (!version || !baseUrl || !joinCode) return null;
  return { version, baseUrl, joinCode, raw };
}

function buildBotPrompt(joinToken) {
  const parsed = parseJoinToken(joinToken);
  if (!parsed) return "（請先按『取得 Join Token』）";

  // CT1 is a version marker for the token format.
  const { version, baseUrl, joinCode, raw } = parsed;

  return [
    "你是一個 Clawtown 遊戲代理人（CloudBot）。",
    "你的任務：把自己綁定到我的角色，切到 H-Mode，開始在小鎮裡移動並打史萊姆。",
    "只允許做遊戲相關行為（link/mode/goal/world/chat/intent/cast）。",
    "",
    "[CLAWTOWN_JOIN_V1]",
    `join_token_version: ${version}  # CT1 是 join token 格式版本標記`,
    `base_url: ${baseUrl}`,
    `join_code: ${joinCode}`,
    "",
    "步驟：",
    "1) Link（取得 botToken）",
    `   curl -s -X POST "${baseUrl}/api/bot/link" -H 'Content-Type: application/json' -d '{"joinToken":"${raw}"}'`,
    "   解析回傳 JSON，記住 botToken。",
    "2) 切換到 H-Mode",
    `   curl -s -X POST "${baseUrl}/api/bot/mode" -H "Authorization: Bearer <botToken>" -H 'Content-Type: application/json' -d '{"mode":"agent"}'`,
    "3) 開始行為 loop（每 1~2 秒一次）：",
    `   - 讀世界：curl -s "${baseUrl}/api/bot/world" -H "Authorization: Bearer <botToken>"`,
    "   - 如果附近有活著的史萊姆：呼叫 cast（攻擊）",
    `     curl -s -X POST "${baseUrl}/api/bot/cast" -H "Authorization: Bearer <botToken>" -H 'Content-Type: application/json' -d '{"spell":"signature"}'`,
    "   - 否則：設定一個目標點在廣場附近走動",
    `     curl -s -X POST "${baseUrl}/api/bot/goal" -H "Authorization: Bearer <botToken>" -H 'Content-Type: application/json' -d '{"x":520,"y":300}'`,
    `   - 公開意圖（可選）：curl -s -X POST "${baseUrl}/api/bot/intent" ...`,
    "",
    "完成後請回覆我：『已連線，開始行動』",
    "[/CLAWTOWN_JOIN_V1]",
  ].join("\n");
}

copyJoinTokenBtn?.addEventListener("click", () => copyText(joinTokenEl?.value));
copySandboxJoinTokenBtn?.addEventListener("click", () => copyText(sandboxJoinTokenEl?.value));

copyBotPromptBtn?.addEventListener("click", () => copyText(botPromptEl?.value));
copyBotPromptDockerBtn?.addEventListener("click", () => copyText(buildBotPrompt(sandboxJoinTokenEl?.value || "")));

boardSend.addEventListener("click", () => {
  const content = String(boardInput.value || "").trim();
  if (!content) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "board_post", content }));
  boardInput.value = "";
});

chatSend.addEventListener("click", () => {
  const text = String(chatInput.value || "").trim();
  if (!text) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chat", text }));
  chatInput.value = "";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    chatSend.click();
  }
});

inventoryEl?.addEventListener("click", (e) => {
  const btn = e.target && e.target.closest && e.target.closest("button[data-equip]");
  if (!btn) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const itemId = btn.getAttribute("data-equip");
  if (!itemId) return;
  ws.send(JSON.stringify({ type: "equip", itemId }));
});

craftJellyBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "craft", recipe: "jelly_3" }));
});

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: { raw: text } };
  }
}

partyCreateBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "party_create" }));
});

partyLeaveBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "party_leave" }));
});

partyMakeCodeBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "party_code" }));
});

partyJoinBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const code = String(partyJoinCodeInput?.value || "").trim().toUpperCase();
  if (!code) return;
  ws.send(JSON.stringify({ type: "party_join", joinCode: code }));
});

partySummonBtn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "party_summon" }));
});

canvas.addEventListener("click", (e) => {
  if (!you) return;
  if (you.mode !== "manual") return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  if (pendingTarget) {
    if (Date.now() <= pendingTargetUntilMs) {
      castSpell(pendingTarget.spell, x, y);
    }
    pendingTarget = null;
    pendingTargetUntilMs = 0;
    statusEl.textContent = "已連線";
    return;
  }

  ws.send(JSON.stringify({ type: "set_goal", x, y }));
});

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") keyState.up = true;
  if (e.key === "s" || e.key === "ArrowDown") keyState.down = true;
  if (e.key === "a" || e.key === "ArrowLeft") keyState.left = true;
  if (e.key === "d" || e.key === "ArrowRight") keyState.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") keyState.up = false;
  if (e.key === "s" || e.key === "ArrowDown") keyState.down = false;
  if (e.key === "a" || e.key === "ArrowLeft") keyState.left = false;
  if (e.key === "d" || e.key === "ArrowRight") keyState.right = false;
});

function stepInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!you) return;
  if (you.mode !== "manual") return;
  const t = Date.now();
  if (t - lastMoveSentAt < 80) return;
  lastMoveSentAt = t;

  const dx = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
  const dy = (keyState.down ? 1 : 0) - (keyState.up ? 1 : 0);
  if (dx === 0 && dy === 0) return;
  ws.send(JSON.stringify({ type: "move", dx, dy }));
}

function renderHeader() {
  if (!you) return;
  jobEl.textContent = `職業：${you.job}`;
  levelEl.textContent = `等級 ${you.level}（${you.xp}/${you.xpToNext}）`;
  modeManualBtn.classList.toggle("is-active", you.mode === "manual");
  modeAgentBtn.classList.toggle("is-active", you.mode === "agent");

  if (hudNameEl) hudNameEl.textContent = you.name;
  if (hudJobEl) hudJobEl.textContent = `職業:${you.job}`;
  if (hudLevelEl) hudLevelEl.textContent = `等級:${you.level}`;
  if (hudModeEl) hudModeEl.textContent = you.mode === "agent" ? "H-Mode" : "手動";
  if (hudBotEl) hudBotEl.textContent = you.linkedBot ? "Bot：已連結" : "Bot：未連結";

  if (slot1Name) {
    const n = (you.signatureSpell && you.signatureSpell.name) || "技能1";
    slot1Name.textContent = n || "技能1";
  }

  if (slot4Name) {
    slot4Name.textContent = jobSkillFor(you.job).name;
  }

  if (killsEl) killsEl.textContent = `擊殺：${(you.meta && you.meta.kills) || 0}`;
  if (craftsEl) craftsEl.textContent = `合成：${(you.meta && you.meta.crafts) || 0}`;
  if (pickupsEl) pickupsEl.textContent = `拾取：${(you.meta && you.meta.pickups) || 0}`;

  renderAchievements();

  if (skill1NameEl) {
    const v = (you.signatureSpell && you.signatureSpell.name) || "";
    if (!skill1NameEl.value) skill1NameEl.value = v;
  }
  if (skill1EffectEl) {
    const v = (you.signatureSpell && you.signatureSpell.effect) || "spark";
    if (!skill1EffectEl.value) skill1EffectEl.value = v;
  }

  if (skill4NameEl) {
    const v = (you.jobSkill && you.jobSkill.name) || "";
    if (!skill4NameEl.value) skill4NameEl.value = v;
  }
  if (skill4SpellEl) {
    const v = (you.jobSkill && you.jobSkill.spell) || "";
    if (!skill4SpellEl.value) skill4SpellEl.value = v;
  }

  // inventory header
  if (zennyEl) zennyEl.textContent = `Zeny：${you.zenny ?? 0}`;
  if (atkEl) atkEl.textContent = `ATK：${Math.floor((you.stats && you.stats.atk) || 0)}`;
  if (defEl) defEl.textContent = `DEF：${Math.floor((you.stats && you.stats.def) || 0)}`;

  if (equipWeaponEl) equipWeaponEl.textContent = (you.equipment && you.equipment.weapon) ? (invNameFor(you.equipment.weapon) || you.equipment.weapon) : "—";
  if (equipArmorEl) equipArmorEl.textContent = (you.equipment && you.equipment.armor) ? (invNameFor(you.equipment.armor) || you.equipment.armor) : "—";
  if (equipAccessoryEl) equipAccessoryEl.textContent = (you.equipment && you.equipment.accessory) ? (invNameFor(you.equipment.accessory) || you.equipment.accessory) : "—";

  renderInventory();

  renderParty();
}

function renderParty() {
  if (!partyMembersEl || !state || !you) return;
  const pid = you.partyId;
  const parties = state.parties || [];
  const party = pid ? parties.find((p) => p && p.id === pid) : null;
  if (!party) {
    partyMembersEl.innerHTML = '<div class="helper">尚未加入隊伍。</div>';
    return;
  }

  const leaderId = party.leaderId;
  const rows = (party.members || []).map((m) => {
    const lead = m.id === leaderId ? '（隊長）' : '';
    const mode = m.mode === 'agent' ? 'H-Mode' : '手動';
    return `<div class="item">
      <div class="meta"><span>${escapeHtml(m.name)} ${lead}</span><span>${escapeHtml(mode)} · Lv ${m.level}</span></div>
      <div class="content">${escapeHtml(m.job)} · HP ${m.hp}/${m.maxHp}</div>
    </div>`;
  });
  partyMembersEl.innerHTML = rows.join('');
}

function renderAchievements() {
  if (!achievementsEl || !you) return;
  const meta = you.meta || {};
  const kills = Number(meta.kills || 0);
  const crafts = Number(meta.crafts || 0);

  const list = [];
  if (kills >= 1) list.push({ title: 'First Blood', sub: 'Defeat your first monster.' });
  if (kills >= 10) list.push({ title: 'Slime Hunter I', sub: 'Defeat 10 monsters.' });
  if (kills >= 50) list.push({ title: 'Slime Hunter II', sub: 'Defeat 50 monsters.' });
  if (crafts >= 1) list.push({ title: 'Crafter', sub: 'Craft your first equipment.' });
  if (crafts >= 10) list.push({ title: 'Workshop Regular', sub: 'Craft 10 times.' });

  if (list.length === 0) {
    achievementsEl.innerHTML = '<div class="helper">還沒有成就。去打史萊姆、合成裝備吧。</div>';
    return;
  }

  achievementsEl.innerHTML = list
    .slice(0, 6)
    .map((a) => `<div class="ach"><div class="ach-title">${escapeHtml(a.title)}</div><div class="ach-sub">${escapeHtml(a.sub)}</div></div>`)
    .join('');
}

function invNameFor(itemId) {
  if (!you || !Array.isArray(you.inventory)) return "";
  const row = you.inventory.find((it) => it && it.itemId === itemId);
  return row ? row.name : "";
}

function renderInventory() {
  if (!inventoryEl || !you) return;
  const items = Array.isArray(you.inventory) ? you.inventory : [];

  // update craft hint
  const jelly = items.find((it) => it && it.itemId === 'jelly');
  const jellyQty = jelly ? Number(jelly.qty || 0) : 0;
  if (craftJellyHintBtn) {
    craftJellyHintBtn.textContent = `需要 3 Jelly（${jellyQty}）`;
  }
  if (craftJellyBtn) {
    craftJellyBtn.disabled = jellyQty < 3;
  }

  if (items.length === 0) {
    inventoryEl.innerHTML = '<div class="helper">背包是空的。去打史萊姆吧。</div>';
    return;
  }

  const canEquip = (it) => it && (it.slot === 'weapon' || it.slot === 'armor' || it.slot === 'accessory');
  const eq = (you.equipment || {});

  inventoryEl.innerHTML = items
    .slice(0, 80)
    .map((it) => {
      const qty = Math.max(1, Number(it.qty || 1));
      const stats = it.stats || {};
      const statBits = [];
      if (stats.atk) statBits.push(`atk+${stats.atk}`);
      if (stats.def) statBits.push(`def+${stats.def}`);
      if (stats.crit) statBits.push(`crit+${Math.round(stats.crit * 100)}%`);
      if (stats.aspd) statBits.push(`aspd+${Math.round(stats.aspd * 100)}%`);
      const sub = [it.slot, qty > 1 ? `x${qty}` : null, statBits.length ? statBits.join(' ') : null].filter(Boolean).join(' · ');

      let equipped = false;
      if (it.slot === 'weapon' && eq.weapon === it.itemId) equipped = true;
      if (it.slot === 'armor' && eq.armor === it.itemId) equipped = true;
      if (it.slot === 'accessory' && eq.accessory === it.itemId) equipped = true;

      const actions = canEquip(it)
        ? `<div class="inv-actions">
             <button class="btn btn-ghost" data-equip="${escapeHtml(it.itemId)}">${equipped ? '已裝備' : '裝備'}</button>
           </div>`
        : '';

      return `<div class="inv-item">
        <div class="inv-left">
          <div class="inv-name">${escapeHtml(it.name || it.itemId || '')}</div>
          <div class="inv-sub">${escapeHtml(sub)}</div>
        </div>
        ${actions}
      </div>`;
    })
    .join('');
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state) return;

  const t = state.world.tileSize;
  drawTerrain(t);

  drawDrops();

  // fx
  const now = Date.now();
  recentFx = recentFx.filter((fx) => now - Date.parse(fx.createdAt) < 1200);
  for (const fx of recentFx) {
    const age = now - Date.parse(fx.createdAt);
    const p = 1 - age / 1200;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p);

    const type = String(fx.type || "spark");
    const r = 18 + (1 - p) * 44;
    const payload = fx.payload || {};

    const palette = {
      spark: { fill: "rgba(184,135,27,0.20)", stroke: "rgba(184,135,27,0.55)" },
      blink: { fill: "rgba(43,108,176,0.16)", stroke: "rgba(43,108,176,0.55)" },
      mark: { fill: "rgba(185,28,28,0.10)", stroke: "rgba(185,28,28,0.62)" },
      echo: { fill: "rgba(15,118,110,0.12)", stroke: "rgba(15,118,110,0.55)" },
      guard: { fill: "rgba(22,163,74,0.12)", stroke: "rgba(22,163,74,0.55)" },

      fireball: { fill: "rgba(185,28,28,0.12)", stroke: "rgba(185,28,28,0.62)" },
      hail: { fill: "rgba(37,99,235,0.10)", stroke: "rgba(37,99,235,0.58)" },
      arrow: { fill: "rgba(0,0,0,0)", stroke: "rgba(19,27,42,0.62)" },
      cleave: { fill: "rgba(184,135,27,0.14)", stroke: "rgba(184,135,27,0.62)" },
      flurry: { fill: "rgba(43,108,176,0.10)", stroke: "rgba(43,108,176,0.58)" },
      crit: { fill: "rgba(0,0,0,0)", stroke: "rgba(185,28,28,0.78)" },
    };

    const c = palette[type] || palette.spark;

    if (type === "arrow") {
      const fromX = Number.isFinite(Number(payload.fromX)) ? Number(payload.fromX) : fx.x;
      const fromY = Number.isFinite(Number(payload.fromY)) ? Number(payload.fromY) : fx.y;
      const prog = 1 - p;
      const tipX = fromX + (fx.x - fromX) * Math.max(0, Math.min(1, prog * 1.15));
      const tipY = fromY + (fx.y - fromY) * Math.max(0, Math.min(1, prog * 1.15));
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // arrow head
      const dx = tipX - fromX;
      const dy = tipY - fromY;
      const ang = Math.atan2(dy, dx);
      const ah = 10;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(ang - 0.6) * ah, tipY - Math.sin(ang - 0.6) * ah);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(ang + 0.6) * ah, tipY - Math.sin(ang + 0.6) * ah);
      ctx.stroke();

      // impact ring (near end)
      if (prog > 0.72) {
        const q = Math.max(0, Math.min(1, (prog - 0.72) / 0.28));
        ctx.globalAlpha = Math.max(0, p) * q;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 10 + q * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (type === "crit") {
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      const rr = 10 + (1 - p) * 18;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.x + Math.cos(a) * rr, fx.y + Math.sin(a) * rr);
      }
      ctx.stroke();
    } else if (type === "cleave") {
      const rr = Number.isFinite(Number(payload.radius)) ? Number(payload.radius) * 0.6 : 64;
      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, rr, -0.85, 0.85);
      ctx.lineTo(fx.x, fx.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (type === "fireball" || type === "hail") {
      const rr = Number.isFinite(Number(payload.radius)) ? Number(payload.radius) : r * 1.6;
      const prog = 1 - p;

      // telegraph ring
      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, rr * (0.55 + prog * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // raining projectiles
      const seedBase = hashString(fx.id || `${fx.x},${fx.y},${fx.createdAt}`);
      const count = type === "fireball" ? 16 : 22;
      for (let i = 0; i < count; i++) {
        const s1 = seedBase + i * 1013;
        const s2 = seedBase + i * 1013 + 17;
        const s3 = seedBase + i * 1013 + 41;
        const s4 = seedBase + i * 1013 + 89;
        const ang = rand01(s1) * Math.PI * 2;
        const rad = Math.sqrt(rand01(s2)) * rr * 0.92;
        const ox = Math.cos(ang) * rad;
        const oy = Math.sin(ang) * rad;

        const startY = -140 - rand01(s3) * 190;
        const fall = prog * (210 + rand01(s4) * 220);
        const px = fx.x + ox;
        const py = fx.y + oy + startY + fall;

        const impactY = fx.y + oy;
        const localAlpha = Math.max(0, Math.min(1, 1 - Math.abs(prog - 0.62) * 1.25));
        ctx.globalAlpha = Math.max(0, p) * localAlpha;

        if (type === "fireball") {
          // tail
          ctx.strokeStyle = "rgba(251,146,60,0.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py - 16);
          ctx.lineTo(px, py + 8);
          ctx.stroke();

          // ember
          ctx.fillStyle = "rgba(239,68,68,0.9)";
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha *= 0.7;
          ctx.fillStyle = "rgba(251,191,36,0.7)";
          ctx.beginPath();
          ctx.arc(px + 1.6, py - 1.2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // hail shard
          ctx.strokeStyle = "rgba(147,197,253,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 4, py - 8);
          ctx.lineTo(px + 2, py + 10);
          ctx.stroke();
          ctx.globalAlpha *= 0.7;
          ctx.strokeStyle = "rgba(59,130,246,0.6)";
          ctx.beginPath();
          ctx.moveTo(px + 3, py - 6);
          ctx.lineTo(px + 8, py + 6);
          ctx.stroke();
        }

        // impact splash near the end
        if (prog > 0.62) {
          const q = Math.max(0, Math.min(1, (prog - 0.62) / 0.38));
          ctx.globalAlpha = Math.max(0, p) * q;
          ctx.strokeStyle = type === "fireball" ? "rgba(251,146,60,0.55)" : "rgba(147,197,253,0.55)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, impactY, 6 + q * 16, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // inner pulse
      ctx.globalAlpha = Math.max(0, p * 0.65);
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, rr * (0.25 + prog * 0.35), 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === "flurry") {
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const rr = 10 + i * 9 + (1 - p) * 18;
        ctx.globalAlpha = Math.max(0, p * (0.75 - i * 0.18));
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (type === "mark") {
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // crosshair
      ctx.beginPath();
      ctx.moveTo(fx.x - 10, fx.y);
      ctx.lineTo(fx.x + 10, fx.y);
      ctx.moveTo(fx.x, fx.y - 10);
      ctx.lineTo(fx.x, fx.y + 10);
      ctx.stroke();
    } else {
      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // inner pulse
      ctx.globalAlpha = Math.max(0, p * 0.65);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMonsters();

  // players
  for (const p of state.players) {
    const isYou = p.id === playerId;
    ctx.save();
    // shadow
    ctx.beginPath();
    ctx.fillStyle = "rgba(9,19,36,0.18)";
    ctx.ellipse(p.x, p.y + 10, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // avatar
    if (avatarSpriteReady) {
      // Sprite sheet is a 5x8 grid (approx). Use a clean front-facing poring frame.
      const cellW = 134;
      const cellH = 112;
      const sx = 0;
      const sy = 1 * cellH;
      const sw = cellW;
      const sh = cellH;

      const dw = 74;
      const dh = 74;
      const dx = p.x - dw / 2;
      const dy = p.y - dh + 22;
      ctx.drawImage(avatarSprite, sx, sy, sw, sh, dx, dy, dw, dh);

      // mode ring
      if (p.mode === "agent" || isYou) {
        ctx.strokeStyle = p.mode === "agent" ? "rgba(184,135,27,0.78)" : "rgba(43,108,176,0.72)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 10, 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      const base = isYou ? "rgba(43,108,176,0.92)" : "rgba(15,118,110,0.86)";
      const agentGlow = p.mode === "agent" ? "rgba(184,135,27,0.92)" : base;
      ctx.fillStyle = agentGlow;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 2;
      roundRectPath(ctx, p.x - 10, p.y - 14, 20, 22, 8);
      ctx.fill();
      if (isYou) ctx.stroke();

      // face highlight
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      roundRectPath(ctx, p.x - 6, p.y - 11, 12, 10, 6);
      ctx.fill();
    }

    // name
    ctx.font = "12px JetBrains Mono";
    ctx.fillStyle = "rgba(19,27,42,0.92)";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, avatarSpriteReady ? p.y - 58 : p.y - 16);

    // intent (short)
    if (p.intent) {
      ctx.font = "11px Spline Sans";
      ctx.fillStyle = "rgba(19,27,42,0.66)";
      ctx.fillText(p.intent.slice(0, 30), p.x, p.y + 34);
    }

    const speech = localLastSpeech.get(p.id);
    if (speech && Date.now() - speech.atMs < 4500) {
      drawSpeechBubble(p.x, avatarSpriteReady ? p.y - 86 : p.y - 44, speech.text);
    }
    ctx.restore();
  }
}

function drawDrops() {
  const ds = (state && state.drops) || [];
  if (!Array.isArray(ds) || ds.length === 0) return;
  for (const d of ds) {
    const x = d.x;
    const y = d.y;
    // small diamond
    const rarity = String(d.rarity || 'common');
    const fill =
      rarity === 'rare'
        ? 'rgba(37,99,235,0.85)'
        : rarity === 'epic'
          ? 'rgba(185,28,28,0.85)'
          : 'rgba(184,135,27,0.85)';
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = fill;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // sparkle
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMonsters() {
  const mons = (state && state.monsters) || [];
  for (const m of mons) {
    if (!m.alive) continue;
    const x = m.x;
    const y = m.y;

    // shadow
    ctx.beginPath();
    ctx.fillStyle = "rgba(9,19,36,0.16)";
    ctx.ellipse(x, y + 12, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    const fill = m.kind === "slime" ? "rgba(52, 199, 89, 0.85)" : "rgba(255, 59, 48, 0.82)";
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    // highlight
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.arc(x - 5, y - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    // hp bar
    const w = 36;
    const h = 6;
    const left = x - w / 2;
    const top = y - 26;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    roundRectPath(ctx, left, top, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(19,27,42,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const ratio = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
    ctx.fillStyle = ratio > 0.5 ? "rgba(15,118,110,0.85)" : "rgba(184,135,27,0.88)";
    roundRectPath(ctx, left + 1, top + 1, Math.max(0, (w - 2) * ratio), h - 2, 3);
    ctx.fill();

    // name
    ctx.font = "11px JetBrains Mono";
    ctx.fillStyle = "rgba(19,27,42,0.78)";
    ctx.textAlign = "center";
    ctx.fillText(m.name, x, y + 28);
  }
}

function roundRectPath(c, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w / 2, h / 2)));
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

function hash2(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) >>> 0;
  n = (n * 1274126177) >>> 0;
  return n;
}

function hashString(s) {
  let h = 2166136261;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand01(seed) {
  // mulberry32
  let t = (seed >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function drawTerrain(tileSize) {
  const w = state.world.width;
  const h = state.world.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x, y) % 100;
      const g = n < 50 ? "#7ecf7a" : n < 80 ? "#74c970" : "#6ec46a";
      ctx.fillStyle = g;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

      if (n === 3 || n === 17) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x * tileSize + 6, y * tileSize + 10, 2, 2);
        ctx.fillStyle = "rgba(255,198,214,0.6)";
        ctx.fillRect(x * tileSize + 10, y * tileSize + 14, 2, 2);
      }
    }
  }

  // paths
  ctx.fillStyle = "rgba(217, 179, 118, 0.9)";
  ctx.fillRect(0, 9 * tileSize - 10, canvas.width, 20);
  ctx.fillRect(15 * tileSize - 10, 0, 20, canvas.height);

  // plaza
  ctx.fillStyle = "rgba(245, 230, 204, 0.92)";
  ctx.fillRect(13 * tileSize, 7 * tileSize, 4 * tileSize, 4 * tileSize);
  ctx.strokeStyle = "rgba(19,27,42,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(13 * tileSize, 7 * tileSize, 4 * tileSize, 4 * tileSize);

  // pond
  ctx.save();
  ctx.translate(22 * tileSize, 13 * tileSize);
  ctx.fillStyle = "rgba(61, 148, 199, 0.72)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 70, 48, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(19,27,42,0.12)";
  ctx.stroke();
  ctx.restore();

  const trees = [
    [5, 4],
    [7, 5],
    [4, 12],
    [8, 13],
    [24, 4],
    [26, 6],
  ];
  for (const [tx, ty] of trees) {
    const x = tx * tileSize + 16;
    const y = ty * tileSize + 16;
    ctx.fillStyle = "rgba(9,19,36,0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4b8b45";
    ctx.beginPath();
    ctx.arc(x, y - 2, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(x - 6, y - 8, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpeechBubble(x, y, text) {
  const t = String(text || "").replace(/^\[intent\]\s*/i, "").slice(0, 40);
  if (!t) return;
  ctx.save();
  ctx.font = "11px Spline Sans";
  const padX = 10;
  const w = Math.min(240, ctx.measureText(t).width + padX * 2);
  const h = 24;
  const left = x - w / 2;
  const top = y - h;

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.strokeStyle = "rgba(19,27,42,0.16)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, left, top, w, h, 10);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 6, top + h);
  ctx.lineTo(x, top + h + 8);
  ctx.lineTo(x + 6, top + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(19,27,42,0.82)";
  ctx.textAlign = "center";
  ctx.fillText(t, x, top + 16);
  ctx.restore();
}

function renderFeed(el, items, kind) {
  if (!el) return;
  const html = items
    .slice()
    .reverse()
    .map((it) => {
      const who = kind === "board" ? it.author : it.from;
      const metaLeft = `${escapeHtml(who.name)}`;
      const metaRight = new Date(it.createdAt).toLocaleTimeString();
      const content = kind === "board" ? it.content : it.text;
      const badge = kind === "chat" && it.kind === "system" ? "system" : "";
      return `
        <div class="item">
          <div class="meta"><div>${metaLeft}${badge ? ` <span style=\"color:rgba(251,191,36,0.9)\">[${badge}]</span>` : ""}</div><div>${escapeHtml(metaRight)}</div></div>
          <div class="content">${escapeHtml(content)}</div>
        </div>
      `;
    })
    .join("");
  el.innerHTML = html;
}

function botThoughtsFromChats(chats) {
  const items = Array.isArray(chats) ? chats : [];
  return items.filter((c) => {
    if (!c) return false;
    if (c.kind !== "chat") return false;
    const t = String(c.text || "");
    return t.startsWith("[BOT]");
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function connect() {
  statusEl.textContent = "連線中...";
  const qs = new URLSearchParams({ playerId, name: myName });
  ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws?${qs.toString()}`);

  ws.addEventListener("open", () => {
    statusEl.textContent = "已連線";
  });

  ws.addEventListener("close", () => {
    statusEl.textContent = "已斷線（重連中...）";
    setTimeout(connect, 500);
  });

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(String(e.data));
    if (msg.type === "hello") {
      you = msg.you;
      state = msg.state;
      window.__ct = window.__ct || {};
      window.__ct.state = state;
      window.__ct.you = you;
      recentFx = (msg.recentFx || []).concat(recentFx);
      window.__ct.recentFx = recentFx;

      renderHeader();
      renderFeed(boardEl, state.board || [], "board");
      renderFeed(chatEl, state.chats || [], "chat");
      renderFeed(botLogEl, botThoughtsFromChats(state.chats || []), "chat");
      refreshHat();
      return;
    }
    if (msg.type === "state") {
      state = msg.state;
      window.__ct = window.__ct || {};
      window.__ct.state = state;
      if (state?.players) {
        you = state.players.find((p) => p.id === playerId) || you;
        window.__ct.you = you;
      }

      for (const c of state.chats || []) {
        if (c.kind !== "chat") continue;
        const created = Date.parse(c.createdAt);
        if (!Number.isFinite(created)) continue;
        const prev = localLastSpeech.get(c.from.id);
        if (!prev || created > prev.atMs) {
          localLastSpeech.set(c.from.id, { text: c.text, atMs: created });
        }
      }

      renderHeader();
      renderFeed(boardEl, state.board || [], "board");
      renderFeed(chatEl, state.chats || [], "chat");
      renderFeed(botLogEl, botThoughtsFromChats(state.chats || []), "chat");
      draw();
      return;
    }
    if (msg.type === "fx") {
      recentFx.unshift(msg.fx);
      window.__ct = window.__ct || {};
      window.__ct.recentFx = recentFx;
      return;
    }

    if (msg.type === "party_code") {
      if (partyCodeInput) partyCodeInput.value = String(msg.joinCode || "");
      statusEl.textContent = "隊伍：已產生邀請碼";
      return;
    }

    if (msg.type === "party_error") {
      statusEl.textContent = String(msg.error || "隊伍：操作失敗");
      return;
    }
  });
}

function loop() {
  stepInput();
  draw();
  requestAnimationFrame(loop);
}

ensurePlayer().then(() => {
  persist();
  connect();
  loop();
});

function openOnboardingIfNeeded() {
  if (!onboardingEl) return;
  const key = "clawtown.onboarding.v1";
  if (localStorage.getItem(key)) return;

  onboardingEl.classList.add("is-open");
  onboardingEl.setAttribute("aria-hidden", "false");

  function close() {
    onboardingEl.classList.remove("is-open");
    onboardingEl.setAttribute("aria-hidden", "true");
    localStorage.setItem(key, "1");
  }

  onboardingStart?.addEventListener("click", () => close(), { once: true });
  onboardingGoHat?.addEventListener(
    "click",
    () => {
      close();
      openTab("hat");
    },
    { once: true },
  );

  onboardingEl.addEventListener(
    "click",
    (e) => {
      if (e.target === onboardingEl) close();
    },
    { once: true },
  );
}

openOnboardingIfNeeded();
function loop() {
  stepInput();
  draw();
  requestAnimationFrame(loop);
}

ensurePlayer().then(() => {
  persist();
  connect();
  loop();
});

function openOnboardingIfNeeded() {
  if (!onboardingEl) return;
  const key = "clawtown.onboarding.v1";
  if (localStorage.getItem(key)) return;

  onboardingEl.classList.add("is-open");
  onboardingEl.setAttribute("aria-hidden", "false");

  function close() {
    onboardingEl.classList.remove("is-open");
    onboardingEl.setAttribute("aria-hidden", "true");
    localStorage.setItem(key, "1");
  }

  onboardingStart?.addEventListener("click", () => close(), { once: true });
  onboardingGoHat?.addEventListener(
    "click",
    () => {
      close();
      openTab("hat");
    },
    { once: true },
  );

  onboardingEl.addEventListener(
    "click",
    (e) => {
      if (e.target === onboardingEl) close();
    },
    { once: true },
  );
}

openOnboardingIfNeeded();
