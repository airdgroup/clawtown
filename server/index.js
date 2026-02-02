const path = require("path");
const http = require("http");
const crypto = require("crypto");

const express = require("express");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);

const WORLD = {
  width: 30,
  height: 18,
  tileSize: 32,
  tickMs: 100,
};

function nowMs() {
  return Date.now();
}

function randomCode(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomToken(prefix) {
  const raw = crypto.randomBytes(24).toString("base64url");
  return `${prefix}_${raw}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function normalizeName(s) {
  const name = String(s || "").trim();
  if (!name) return "Anonymous";
  return name.slice(0, 24);
}

function safeText(s, maxLen) {
  const text = String(s || "").replace(/[\r\n\t]+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, maxLen);
}

function getRequestBaseUrl(req) {
  const rawProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
  const proto = rawProto.split(",")[0].trim() || "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
  return `${proto}://${host}`;
}

function toWsUrl(baseUrl, wsPath) {
  const wsProto = baseUrl.startsWith("https://") ? "wss://" : "ws://";
  return wsProto + baseUrl.replace(/^https?:\/\//, "") + wsPath;
}

function levelForXp(xp) {
  // v1 simple curve
  let level = 1;
  let need = 10;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = 10 + (level - 1) * 5;
    if (level >= 50) break;
  }
  return level;
}

function xpToNext(level) {
  return 10 + (level - 1) * 5;
}

const players = new Map(); // playerId -> player
const botTokens = new Map(); // botToken -> playerId
const joinCodes = new Map(); // joinCode -> { playerId, expiresAt }

const monsters = new Map(); // monsterId -> monster

const boardPosts = []; // newest last
const chats = []; // newest last
const fxEvents = []; // ephemeral; stored briefly for late join

let emitFx = () => {};

function getOrCreatePlayer(playerId, name) {
  const id = String(playerId || "").trim();
  if (!id) return null;
  let p = players.get(id);
  if (!p) {
    p = {
      id,
      name: normalizeName(name),
      x: Math.floor(WORLD.width / 2) * WORLD.tileSize,
      y: Math.floor(WORLD.height / 2) * WORLD.tileSize,
      facing: "down",
      mode: "manual", // manual | agent
      intent: "",
      interrupt: "all", // off | mentions | nearby | all
      hp: 30,
      maxHp: 30,
      level: 1,
      xp: 0,
      statPoints: 0,
      job: "novice",
      jobSkill: {
        name: "職業技",
        spell: "signature",
      },
      signatureSpell: {
        name: "",
        tagline: "",
        effect: "spark",
      },
      goal: null, // { x, y }
      linkedBot: false,
      hat: {
        submittedAt: null,
        answers: null,
        localResult: null,
        botResult: null,
      },
      lastMoveAt: 0,
      lastChatAt: 0,
      lastCastAt: 0,
      connectedAt: nowMs(),
      lastSeenAt: nowMs(),
    };
    players.set(id, p);
    pushChat({
      kind: "system",
      text: `${p.name} entered the town.`,
      from: { id: "system", name: "Town" },
    });
  } else if (name) {
    p.name = normalizeName(name);
  }
  p.lastSeenAt = nowMs();
  return p;
}

function defaultJobSkillForJob(job) {
  const j = String(job || "").toLowerCase();
  if (j === "mage") return { name: "火球雨", spell: "fireball" };
  if (j === "archer") return { name: "遠程射擊", spell: "arrow" };
  if (j === "knight") return { name: "橫掃", spell: "cleave" };
  if (j === "assassin") return { name: "疾刺", spell: "flurry" };
  if (j === "bard") return { name: "回音彈", spell: "signature" };
  return { name: "練習斬", spell: "signature" };
}

function toPublicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    x: Math.round(p.x),
    y: Math.round(p.y),
    facing: p.facing,
    mode: p.mode,
    intent: safeText(p.intent, 140),
    interrupt: p.interrupt,
    hp: p.hp,
    maxHp: p.maxHp,
    level: p.level,
    xp: p.xp,
    xpToNext: xpToNext(p.level),
    statPoints: p.statPoints,
    job: p.job,
    jobSkill: {
      name: safeText(p.jobSkill?.name || "", 48),
      spell: String(p.jobSkill?.spell || "signature"),
    },
    signatureSpell: {
      name: safeText(p.signatureSpell?.name || "", 48),
      tagline: safeText(p.signatureSpell?.tagline || "", 120),
      effect: p.signatureSpell?.effect || "spark",
    },
    linkedBot: p.linkedBot,
  };
}

function toPublicMonster(m) {
  return {
    id: m.id,
    kind: m.kind,
    name: m.name,
    x: Math.round(m.x),
    y: Math.round(m.y),
    hp: m.hp,
    maxHp: m.maxHp,
    alive: m.alive,
  };
}

function spawnInitialMonsters() {
  if (monsters.size > 0) return;

  const make = (id, kind, name, x, y, maxHp) => {
    monsters.set(id, {
      id,
      kind,
      name,
      x,
      y,
      hp: maxHp,
      maxHp,
      alive: true,
      respawnAt: null,
      vx: Math.random() < 0.5 ? -1 : 1,
      vy: Math.random() < 0.5 ? -1 : 1,
      nextWanderAt: nowMs() + 500 + Math.floor(Math.random() * 1500),
    });
  };

  // Put slimes near the spawn plaza so v1 feels alive.
  make("m_slime_1", "slime", "Poring", 13 * WORLD.tileSize + 28, 9 * WORLD.tileSize + 18, 18);
  make("m_slime_2", "slime", "Drops", 17 * WORLD.tileSize + 18, 9 * WORLD.tileSize + 6, 14);
  make("m_slime_3", "slime", "Poporing", 15 * WORLD.tileSize + 70, 11 * WORLD.tileSize + 18, 20);
}

function randomSpawnPoint() {
  const pts = [
    [13 * WORLD.tileSize + 24, 9 * WORLD.tileSize + 18],
    [17 * WORLD.tileSize + 18, 9 * WORLD.tileSize + 6],
    [15 * WORLD.tileSize + 70, 11 * WORLD.tileSize + 18],
    [12 * WORLD.tileSize + 18, 11 * WORLD.tileSize + 26],
    [18 * WORLD.tileSize + 22, 7 * WORLD.tileSize + 18],
  ];
  return pts[Math.floor(Math.random() * pts.length)];
}

function tickMonsters() {
  const speed = 1.4;
  const t = nowMs();
  for (const m of monsters.values()) {
    if (!m.alive) continue;

    if (!Number.isFinite(m.vx) || !Number.isFinite(m.vy)) {
      m.vx = Math.random() < 0.5 ? -1 : 1;
      m.vy = Math.random() < 0.5 ? -1 : 1;
      m.nextWanderAt = t + 800;
    }

    if (!m.nextWanderAt || t >= m.nextWanderAt) {
      // small random direction change (wandering)
      const r = Math.random();
      if (r < 0.33) m.vx = Math.random() < 0.5 ? -1 : 1;
      if (r > 0.66) m.vy = Math.random() < 0.5 ? -1 : 1;
      m.nextWanderAt = t + 700 + Math.floor(Math.random() * 1400);
    }

    m.x += m.vx * speed;
    m.y += m.vy * speed;

    const minX = 1 * WORLD.tileSize;
    const maxX = (WORLD.width - 2) * WORLD.tileSize;
    const minY = 1 * WORLD.tileSize;
    const maxY = (WORLD.height - 2) * WORLD.tileSize;
    if (m.x < minX) {
      m.x = minX;
      m.vx = 1;
    }
    if (m.x > maxX) {
      m.x = maxX;
      m.vx = -1;
    }
    if (m.y < minY) {
      m.y = minY;
      m.vy = 1;
    }
    if (m.y > maxY) {
      m.y = maxY;
      m.vy = -1;
    }
  }
}

function tryRespawnMonsters() {
  const t = nowMs();
  for (const m of monsters.values()) {
    if (m.alive) continue;
    if (!m.respawnAt) continue;
    if (t < m.respawnAt) continue;
    m.alive = true;
    m.hp = m.maxHp;
    m.respawnAt = null;
    const [sx, sy] = randomSpawnPoint();
    m.x = sx;
    m.y = sy;
    m.vx = Math.random() < 0.5 ? -1 : 1;
    m.vy = Math.random() < 0.5 ? -1 : 1;
    m.nextWanderAt = nowMs() + 500 + Math.floor(Math.random() * 1500);
    pushChat({ kind: "system", text: `${m.name} returned.`, from: { id: "system", name: "Town" } });
  }
}

function findNearestAliveMonster(x, y, maxDist) {
  let best = null;
  let bestD2 = maxDist * maxDist;
  for (const m of monsters.values()) {
    if (!m.alive) continue;
    const d2 = dist2(x, y, m.x, m.y);
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = m;
    }
  }
  return best;
}

function damageForPlayer(p) {
  if (!p) return 2;
  if (p.job === "knight") return 5;
  if (p.job === "archer") return 4;
  if (p.job === "mage") return 6;
  if (p.job === "bard") return 3;
  if (p.job === "assassin") return 3;
  return 2;
}

function applyDamage(p, m, dmg) {
  if (!p || !m || !m.alive) return { ok: false };
  const dealt = Math.max(0, Math.floor(Number(dmg) || 0));
  if (dealt <= 0) return { ok: false };

  const prevHp = m.hp;
  m.hp = Math.max(0, m.hp - dealt);

  let killed = false;
  if (prevHp > 0 && m.hp <= 0) {
    m.alive = false;
    m.respawnAt = nowMs() + 6000;
    killed = true;
    pushChat({ kind: "system", text: `${p.name} defeated ${m.name}! (+8 XP)`, from: { id: "system", name: "Town" } });
    p.xp += 8;
    const newLevel = levelForXp(p.xp);
    if (newLevel > p.level) {
      p.level = newLevel;
      p.statPoints += 1;
      p.maxHp += 2;
      p.hp = p.maxHp;
      pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
    }
  }

  return { ok: true, dealt, hp: m.hp, alive: m.alive, killed };
}

function rateLimitCast(p, minMs) {
  const t = nowMs();
  const gap = t - (p.lastCastAt || 0);
  if (gap < minMs) return { ok: false, retryInMs: minMs - gap };
  p.lastCastAt = t;
  return { ok: true };
}

function performCast(p, { spell, x, y, source }) {
  if (!p) return { ok: false, reason: "no player" };
  const s = String(spell || "signature").trim().toLowerCase();

  // Default cast rate: keep v1 responsive but avoid spam.
  const cd = s === "flurry" ? 520 : 700;
  const rl = rateLimitCast(p, cd);
  if (!rl.ok) return { ok: false, reason: "cooldown", retryInMs: rl.retryInMs };

  if (s === "signature" || s === "attack") {
    return performAttack(p, source);
  }

  if (s === "fireball" || s === "hail") {
    // Mage AoE: target a point and hit monsters in radius.
    const cx = Number.isFinite(Number(x)) ? Number(x) : p.x;
    const cy = Number.isFinite(Number(y)) ? Number(y) : p.y;
    const radius = s === "fireball" ? 130 : 150;
    const base = s === "fireball" ? 5 : 4;

    const hits = [];
    for (const m of monsters.values()) {
      if (!m.alive) continue;
      if (dist2(cx, cy, m.x, m.y) > radius * radius) continue;
      const out = applyDamage(p, m, base);
      if (out.ok) hits.push({ id: m.id, dmg: out.dealt, hp: out.hp, alive: out.alive, killed: out.killed });
    }

    pushFx({
      type: s,
      x: cx,
      y: cy,
      byPlayerId: p.id,
      payload: { radius, hits, source },
    });

    return { ok: true, spell: s, hits: hits.length };
  }

  if (s === "arrow") {
    // Archer ranged shot: long range single target.
    const range = 260;
    const facing = String(p.facing || "down");
    const inFront = (mm) => {
      const dx = mm.x - p.x;
      const dy = mm.y - p.y;
      if (facing === "left") return dx < -6;
      if (facing === "right") return dx > 6;
      if (facing === "up") return dy < -6;
      return dy > 6;
    };

    let m = null;
    let bestD2 = range * range;
    for (const mm of monsters.values()) {
      if (!mm.alive) continue;
      if (!inFront(mm)) continue;
      const d2 = dist2(p.x, p.y, mm.x, mm.y);
      if (d2 <= bestD2) {
        bestD2 = d2;
        m = mm;
      }
    }

    if (!m) m = findNearestAliveMonster(p.x, p.y, range);
    if (!m) {
      pushFx({ type: "arrow", x: p.x, y: p.y, byPlayerId: p.id, payload: { miss: true, fromX: p.x, fromY: p.y, source } });
      return { ok: false, reason: "no target" };
    }

    const dmg = Math.max(2, damageForPlayer(p));
    const out = applyDamage(p, m, dmg);
    pushFx({ type: "arrow", x: m.x, y: m.y, byPlayerId: p.id, payload: { target: m.id, dmg: out.dealt, fromX: p.x, fromY: p.y, source } });
    return { ok: true, target: m.id, hp: out.hp, alive: out.alive };
  }

  if (s === "cleave") {
    // Knight cleave: hit up to 3 nearby.
    const radius = 120;
    const dmg = 4;
    const candidates = [];
    for (const m of monsters.values()) {
      if (!m.alive) continue;
      const d2 = dist2(p.x, p.y, m.x, m.y);
      if (d2 <= radius * radius) candidates.push({ m, d2 });
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    const hits = [];
    for (const c of candidates.slice(0, 3)) {
      const out = applyDamage(p, c.m, dmg);
      if (out.ok) hits.push({ id: c.m.id, dmg: out.dealt, hp: out.hp, alive: out.alive, killed: out.killed });
    }
    if (hits.length === 0) {
      pushFx({ type: "spark", x: p.x, y: p.y, byPlayerId: p.id, payload: { miss: true, source } });
      return { ok: false, reason: "no target" };
    }
    pushFx({ type: "cleave", x: p.x, y: p.y, byPlayerId: p.id, payload: { radius, hits, source } });
    return { ok: true, spell: s, hits: hits.length };
  }

  if (s === "flurry") {
    // Assassin flurry: rapid hits with crit.
    const range = 92;
    const m = findNearestAliveMonster(p.x, p.y, range);
    if (!m) {
      pushFx({ type: "spark", x: p.x, y: p.y, byPlayerId: p.id, payload: { miss: true, source } });
      return { ok: false, reason: "no target" };
    }

    const strikes = 3;
    const base = 2;
    const critChance = 0.28;
    const critMult = 2;
    const hits = [];
    for (let i = 0; i < strikes; i++) {
      if (!m.alive) break;
      const crit = Math.random() < critChance;
      const dmg = crit ? base * critMult : base;
      const out = applyDamage(p, m, dmg);
      if (out.ok) hits.push({ dmg: out.dealt, crit, hp: out.hp, alive: out.alive, killed: out.killed });
      if (crit) pushFx({ type: "crit", x: m.x, y: m.y, byPlayerId: p.id, payload: { target: m.id, dmg: out.dealt, source } });
    }
    pushFx({ type: "flurry", x: m.x, y: m.y, byPlayerId: p.id, payload: { target: m.id, hits, fromX: p.x, fromY: p.y, source } });
    return { ok: true, target: m.id, hits: hits.length, hp: m.hp, alive: m.alive };
  }

  return { ok: false, reason: "unknown spell" };
}

function performAttack(p, source) {
  if (!p) return { ok: false, reason: "no player" };
  // v1: a slightly generous melee range keeps combat responsive (and reduces flakiness in UI tests).
  const range = 120;
  const m = findNearestAliveMonster(p.x, p.y, range);
  if (!m) {
    pushFx({ type: "spark", x: p.x, y: p.y, byPlayerId: p.id, payload: { miss: true, source } });
    return { ok: false, reason: "no target" };
  }

  const dmg = damageForPlayer(p);
  const out = applyDamage(p, m, dmg);
  pushFx({ type: p.signatureSpell.effect || "spark", x: m.x, y: m.y, byPlayerId: p.id, payload: { target: m.id, dmg, source } });

  return { ok: true, target: m.id, hp: out.hp, alive: out.alive };
}

function pushBoardPost({ author, content }) {
  const text = safeText(content, 280);
  if (!text) return null;
  const post = {
    id: randomToken("post"),
    createdAt: new Date().toISOString(),
    author: { id: author.id, name: author.name },
    content: text,
  };
  boardPosts.push(post);
  while (boardPosts.length > 50) boardPosts.shift();
  return post;
}

function pushChat({ kind, text, from, toPlayerId }) {
  const msgText = safeText(text, 280);
  if (!msgText) return null;
  const chat = {
    id: randomToken("chat"),
    createdAt: new Date().toISOString(),
    kind: kind || "chat", // chat | system
    from: { id: from.id, name: from.name },
    text: msgText,
    toPlayerId: toPlayerId || null,
  };
  chats.push(chat);
  while (chats.length > 100) chats.shift();
  return chat;
}

function pushFx({ type, x, y, byPlayerId, payload }) {
  const fx = {
    id: randomToken("fx"),
    createdAt: new Date().toISOString(),
    type,
    x: Math.round(x),
    y: Math.round(y),
    byPlayerId: byPlayerId || null,
    payload: payload || {},
  };
  fxEvents.push(fx);
  while (fxEvents.length > 50) fxEvents.shift();
  emitFx(fx);
  return fx;
}

function computeLocalHatResult({ answers }) {
  const a = answers || {};
  const goal = String(a.goal || "");
  const conflict = String(a.conflict || "");
  const magic = String(a.magic || "");

  let job = "novice";
  const reasons = [];

  if (goal === "combat") {
    if (magic === "speed" && conflict !== "direct") job = "assassin";
    else if (conflict === "direct") job = "knight";
    else job = "archer";
  } else if (goal === "explore") {
    if (magic === "speed" && conflict !== "direct") job = "assassin";
    else job = conflict === "direct" ? "archer" : "mage";
  } else if (goal === "social") {
    job = "bard";
  } else if (goal === "build") {
    job = "mage";
  }

  if (magic === "power") reasons.push("You gravitate toward decisive impact.");
  if (magic === "wisdom") reasons.push("You prefer understanding systems before acting.");
  if (magic === "speed") reasons.push("You like agility and clever positioning.");
  if (magic === "guard") reasons.push("You naturally protect and support others.");

  if (conflict === "direct") reasons.push("You handle conflict head-on.");
  if (conflict === "strategy") reasons.push("You choose strategy and timing over force.");
  if (conflict === "empathy") reasons.push("You prioritize understanding people first.");

  const signature = {
    name:
      job === "mage"
        ? "Starstep"
        : job === "archer"
          ? "Hawkeye Mark"
          : job === "assassin"
            ? "Shadow Puncture"
            : job === "bard"
              ? "Echo Oath"
              : "Aegis Roar",
    tagline: "A spell that feels uniquely yours.",
    effect: job === "mage" ? "blink" : job === "archer" ? "mark" : job === "assassin" ? "blink" : job === "bard" ? "echo" : "guard",
  };

  return {
    job,
    reasons: reasons.slice(0, 3),
    signature,
  };
}

function setPlayerJobAndSignature(p, result) {
  if (!p || !result) return;
  if (result.job) p.job = result.job;
  // keep a sensible default job skill when job changes
  p.jobSkill = defaultJobSkillForJob(p.job);
  if (result.signature) {
    p.signatureSpell = {
      name: safeText(result.signature.name || "", 48),
      tagline: safeText(result.signature.tagline || "", 140),
      effect: String(result.signature.effect || "spark"),
    };
  }
}

function authBot(req) {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const playerId = botTokens.get(token);
  if (!playerId) return null;
  const p = players.get(playerId);
  if (!p) return null;
  return { token, player: p };
}

const app = express();
app.use(express.json({ limit: "256kb" }));

if (String(process.env.CT_TEST || "").trim() === "1") {
  app.post("/api/debug/reset", (_req, res) => {
    players.clear();
    botTokens.clear();
    joinCodes.clear();
    monsters.clear();
    boardPosts.length = 0;
    chats.length = 0;
    fxEvents.length = 0;
    spawnInitialMonsters();
    res.json({ ok: true });
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/players/ensure", (req, res) => {
  const { playerId, name } = req.body || {};
  const p = getOrCreatePlayer(playerId, name);
  if (!p) return res.status(400).json({ ok: false, error: "missing playerId" });
  res.json({ ok: true, player: toPublicPlayer(p) });
});

app.post("/api/join-codes", (req, res) => {
  const { playerId } = req.body || {};
  const p = players.get(String(playerId || "").trim());
  if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });

  // one active code per player
  for (const [code, v] of joinCodes.entries()) {
    if (v.playerId === p.id) joinCodes.delete(code);
  }

  const joinCode = randomCode(6);
  const expiresAt = nowMs() + 5 * 60 * 1000;
  joinCodes.set(joinCode, { playerId: p.id, expiresAt });

  const baseUrl = getRequestBaseUrl(req);
  const host = baseUrl.replace(/^https?:\/\//, "");
  const port = host.includes(":") ? host.split(":").pop() : "";
  const sandboxBaseUrl = port ? `http://host.docker.internal:${port}` : null;

  const joinToken = `CT1|${baseUrl}|${joinCode}`;
  const sandboxJoinToken = sandboxBaseUrl ? `CT1|${sandboxBaseUrl}|${joinCode}` : null;

  res.json({
    ok: true,
    joinCode,
    expiresAt,
    baseUrl,
    joinToken,
    sandboxBaseUrl,
    sandboxJoinToken,
  });
});

app.post("/api/hat/submit", (req, res) => {
  const { playerId, answers } = req.body || {};
  const p = players.get(String(playerId || "").trim());
  if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });

  const sanitized = {
    goal: String(answers?.goal || ""),
    conflict: String(answers?.conflict || ""),
    magic: String(answers?.magic || ""),
    free: safeText(answers?.free || "", 240),
  };

  p.hat.submittedAt = new Date().toISOString();
  p.hat.answers = sanitized;
  p.hat.localResult = computeLocalHatResult({ answers: sanitized });
  p.hat.botResult = null;

  // apply local result immediately (fast Aha). bot may override later.
  setPlayerJobAndSignature(p, p.hat.localResult);

  res.json({ ok: true, localResult: p.hat.localResult });
});

app.get("/api/hat/result", (req, res) => {
  const playerId = String(req.query.playerId || "").trim();
  const p = players.get(playerId);
  if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });
  const result = p.hat.botResult || p.hat.localResult;
  res.json({
    ok: true,
    submittedAt: p.hat.submittedAt,
    answers: p.hat.answers,
    result,
    source: p.hat.botResult ? "bot" : "local",
  });
});

app.post("/api/bot/link", (req, res) => {
  const { joinCode, joinToken } = req.body || {};
  let code = String(joinCode || "").trim().toUpperCase();

  // Convenience: allow sending the whole joinToken.
  // joinToken format: CT1|<baseUrl>|<joinCode>
  if (!code && joinToken) {
    const raw = String(joinToken || "").trim();
    const parts = raw.split("|");
    if (parts.length === 3) code = String(parts[2] || "").trim().toUpperCase();
  }

  const rec = joinCodes.get(code);
  if (!rec) return res.status(404).json({ ok: false, error: "invalid joinCode" });
  if (nowMs() > rec.expiresAt) {
    joinCodes.delete(code);
    return res.status(410).json({ ok: false, error: "joinCode expired" });
  }

  const p = players.get(rec.playerId);
  if (!p) return res.status(404).json({ ok: false, error: "player missing" });

  // rotate token
  for (const [t, pid] of botTokens.entries()) {
    if (pid === p.id) botTokens.delete(t);
  }

  const botToken = randomToken("ctbot");
  botTokens.set(botToken, p.id);
  p.linkedBot = true;
  joinCodes.delete(code);

  pushChat({
    kind: "system",
    text: `${p.name}'s CloudBot is now linked.`,
    from: { id: "system", name: "Town" },
  });

  res.json({
    ok: true,
    botToken,
    playerId: p.id,
    apiBaseUrl: getRequestBaseUrl(req),
    wsUrl: toWsUrl(getRequestBaseUrl(req), "/ws"),
  });
});

app.get("/api/bot/me", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json({ ok: true, player: toPublicPlayer(auth.player) });
});

app.get("/api/bot/world", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;

  const nearbyR2 = Math.pow(6 * WORLD.tileSize, 2);
  const relevantChats = chats
    .filter((c) => {
      if (c.toPlayerId && c.toPlayerId !== p.id) return false;
      if (p.interrupt === "off") return c.kind === "system";
      if (p.interrupt === "all") return true;
      if (p.interrupt === "mentions") {
        return c.kind === "system" || c.text.toLowerCase().includes(p.name.toLowerCase());
      }
      if (p.interrupt === "nearby") {
        const fromP = players.get(c.from.id);
        if (!fromP) return c.kind === "system";
        return dist2(fromP.x, fromP.y, p.x, p.y) <= nearbyR2;
      }
      return true;
    })
    .slice(-25);

  const snapshot = {
    world: { width: WORLD.width, height: WORLD.height, tileSize: WORLD.tileSize },
    you: toPublicPlayer(p),
    players: Array.from(players.values()).map(toPublicPlayer),
    monsters: Array.from(monsters.values()).map(toPublicMonster),
    board: boardPosts.slice(-20),
    chats: relevantChats,
    hat: {
      submittedAt: p.hat.submittedAt,
      answers: p.hat.answers,
      localResult: p.hat.localResult,
      botResult: p.hat.botResult,
    },
  };

  res.json({ ok: true, snapshot });
});

app.post("/api/bot/mode", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const mode = String(req.body?.mode || "").toLowerCase();
  if (!['manual', 'agent'].includes(mode)) return res.status(400).json({ ok: false, error: "invalid mode" });
  auth.player.mode = mode;
  if (mode === "manual") auth.player.goal = null;
  res.json({ ok: true, player: toPublicPlayer(auth.player) });
});

app.post("/api/bot/interrupt", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const level = String(req.body?.level || "").toLowerCase();
  if (!['off', 'mentions', 'nearby', 'all'].includes(level)) return res.status(400).json({ ok: false, error: "invalid level" });
  auth.player.interrupt = level;
  res.json({ ok: true, player: toPublicPlayer(auth.player) });
});

app.post("/api/bot/goal", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const x = Number(req.body?.x);
  const y = Number(req.body?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ ok: false, error: "invalid coords" });
  auth.player.goal = {
    x: clamp(x, 0, (WORLD.width - 1) * WORLD.tileSize),
    y: clamp(y, 0, (WORLD.height - 1) * WORLD.tileSize),
  };
  res.json({ ok: true });
});

app.post("/api/bot/intent", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  auth.player.intent = safeText(req.body?.text || "", 200);
  res.json({ ok: true });
});

app.post("/api/bot/chat", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  const t = nowMs();
  if (t - p.lastChatAt < 1200) return res.status(429).json({ ok: false, error: "rate limited" });
  p.lastChatAt = t;
  pushChat({ kind: "chat", text: req.body?.text, from: { id: p.id, name: p.name } });
  p.xp += 1;
  const newLevel = levelForXp(p.xp);
  if (newLevel > p.level) {
    p.level = newLevel;
    p.statPoints += 1;
    pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
  }
  res.json({ ok: true });
});

app.post("/api/bot/hat-result", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;

  const job = String(req.body?.job || "").toLowerCase();
  const allowedJobs = ["novice", "knight", "mage", "archer", "bard", "assassin"];
  if (job && !allowedJobs.includes(job)) return res.status(400).json({ ok: false, error: "invalid job" });

  const reasons = Array.isArray(req.body?.reasons) ? req.body.reasons.map((r) => safeText(r, 120)).filter(Boolean).slice(0, 4) : [];
  const signature = req.body?.signature || {};

  p.hat.botResult = {
    job: job || p.hat.localResult?.job || p.job,
    reasons,
    signature: {
      name: safeText(signature.name || p.signatureSpell.name || "", 48),
      tagline: safeText(signature.tagline || p.signatureSpell.tagline || "", 140),
      effect: String(signature.effect || p.signatureSpell.effect || "spark"),
    },
  };

  setPlayerJobAndSignature(p, p.hat.botResult);
  pushChat({ kind: "system", text: `${p.name}'s fate was refined by their CloudBot.`, from: { id: "system", name: "Town" } });
  res.json({ ok: true });
});

app.post("/api/bot/cast", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  const spell = req.body?.spell;
  const x = req.body?.x;
  const y = req.body?.y;
  const resolvedSpell = spell === "job" ? p.jobSkill?.spell : spell;
  const out = performCast(p, { spell: resolvedSpell, x, y, source: "bot" });
  res.json({ ok: true, result: out });
});

app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const sockets = new Map(); // ws -> { playerId }
const socketsByPlayer = new Map(); // playerId -> Set(ws)

function bindSocket(ws, playerId) {
  sockets.set(ws, { playerId });
  if (!socketsByPlayer.has(playerId)) socketsByPlayer.set(playerId, new Set());
  socketsByPlayer.get(playerId).add(ws);
}

function unbindSocket(ws) {
  const meta = sockets.get(ws);
  if (!meta) return;
  sockets.delete(ws);
  const set = socketsByPlayer.get(meta.playerId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) socketsByPlayer.delete(meta.playerId);
  }
}

function send(ws, msg) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

emitFx = (fx) => {
  broadcast({ type: "fx", fx });
};

function sendToPlayer(playerId, msg) {
  const set = socketsByPlayer.get(playerId);
  if (!set) return;
  for (const ws of set) send(ws, msg);
}

function currentState() {
  return {
    world: { width: WORLD.width, height: WORLD.height, tileSize: WORLD.tileSize },
    players: Array.from(players.values()).map(toPublicPlayer),
    monsters: Array.from(monsters.values()).map(toPublicMonster),
    board: boardPosts.slice(-20),
    chats: chats.slice(-35),
  };
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const playerId = String(url.searchParams.get("playerId") || "").trim();
  const name = url.searchParams.get("name") || "";

  const p = getOrCreatePlayer(playerId, name);
  if (!p) {
    send(ws, { type: "error", error: "missing playerId" });
    ws.close();
    return;
  }

  bindSocket(ws, p.id);
  send(ws, { type: "hello", you: toPublicPlayer(p), state: currentState(), recentFx: fxEvents.slice(-10) });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    const type = String(msg?.type || "");
    const player = players.get(p.id);
    if (!player) return;
    player.lastSeenAt = nowMs();

    if (type === "set_name") {
      player.name = normalizeName(msg?.name);
      return;
    }

    if (type === "set_mode") {
      const mode = String(msg?.mode || "").toLowerCase();
      if (!['manual', 'agent'].includes(mode)) return;
      player.mode = mode;
      if (mode === "manual") player.goal = null;
      return;
    }

    if (type === "set_intent") {
      if (player.mode !== "manual") return;
      player.intent = safeText(msg?.text || "", 200);
      return;
    }

    if (type === "set_signature") {
      const name = safeText(msg?.name || "", 48);
      const effectRaw = String(msg?.effect || "spark").trim().toLowerCase();
      const allowed = new Set(["spark", "blink", "mark", "echo", "guard"]);
      const effect = allowed.has(effectRaw) ? effectRaw : "spark";
      player.signatureSpell = {
        name,
        tagline: player.signatureSpell?.tagline || "",
        effect,
      };
      return;
    }

    if (type === "set_job_skill") {
      const name = safeText(msg?.name || "", 48);
      const spellRaw = String(msg?.spell || "signature").trim().toLowerCase();
      const allowed = new Set(["signature", "fireball", "hail", "arrow", "cleave", "flurry"]);
      const spell = allowed.has(spellRaw) ? spellRaw : "signature";
      player.jobSkill = { name, spell };
      return;
    }

    if (type === "move") {
      if (player.mode !== "manual") return;
      const t = nowMs();
      if (t - player.lastMoveAt < 60) return;
      player.lastMoveAt = t;
      const dx = clamp(Number(msg?.dx) || 0, -1, 1);
      const dy = clamp(Number(msg?.dy) || 0, -1, 1);
      const speed = 8;
      if (dx !== 0 || dy !== 0) {
        player.x = clamp(player.x + dx * speed, 0, (WORLD.width - 1) * WORLD.tileSize);
        player.y = clamp(player.y + dy * speed, 0, (WORLD.height - 1) * WORLD.tileSize);
        if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
        else if (dy !== 0) player.facing = dy > 0 ? "down" : "up";
      }
      return;
    }

    if (type === "set_goal") {
      if (player.mode !== "manual") return;
      const x = Number(msg?.x);
      const y = Number(msg?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      player.goal = {
        x: clamp(x, 0, (WORLD.width - 1) * WORLD.tileSize),
        y: clamp(y, 0, (WORLD.height - 1) * WORLD.tileSize),
      };
      return;
    }

    if (type === "cast") {
      const resolvedSpell = msg?.spell === "job" ? player.jobSkill?.spell : msg?.spell;
      performCast(player, { spell: resolvedSpell, x: msg?.x, y: msg?.y, source: "manual" });
      return;
    }

    if (type === "chat") {
      const t = nowMs();
      if (t - player.lastChatAt < 1200) return;
      player.lastChatAt = t;
      const created = pushChat({ kind: "chat", text: msg?.text, from: { id: player.id, name: player.name } });
      if (!created) return;
      player.xp += 1;
      const newLevel = levelForXp(player.xp);
      if (newLevel > player.level) {
        player.level = newLevel;
        player.statPoints += 1;
        pushChat({ kind: "system", text: `${player.name} reached Level ${player.level}!`, from: { id: "system", name: "Town" } });
      }
      return;
    }

    if (type === "emote") {
      const emote = String(msg?.emote || "").trim().toLowerCase();
      if (emote === "wave") {
        pushChat({ kind: "chat", text: "*揮手*", from: { id: player.id, name: player.name } });
        pushFx({ type: "echo", x: player.x, y: player.y, byPlayerId: player.id, payload: { emote: "wave" } });
      }
      return;
    }

    if (type === "ping") {
      pushFx({ type: "mark", x: player.x, y: player.y, byPlayerId: player.id, payload: { ping: true } });
      return;
    }

    if (type === "board_post") {
      const post = pushBoardPost({ author: { id: player.id, name: player.name }, content: msg?.content });
      if (!post) return;
      return;
    }
  });

  ws.on("close", () => {
    unbindSocket(ws);
  });
});

function tick() {
  tryRespawnMonsters();
  tickMonsters();
  const speed = 6;
  for (const p of players.values()) {
    if (p.mode === "agent" && p.goal) {
      const gx = p.goal.x;
      const gy = p.goal.y;
      const dx = gx - p.x;
      const dy = gy - p.y;
      const stepX = Math.abs(dx) <= speed ? dx : Math.sign(dx) * speed;
      const stepY = Math.abs(dy) <= speed ? dy : Math.sign(dy) * speed;
      if (Math.abs(dx) > Math.abs(dy)) p.facing = stepX > 0 ? "right" : "left";
      else if (dy !== 0) p.facing = stepY > 0 ? "down" : "up";
      p.x = clamp(p.x + stepX, 0, (WORLD.width - 1) * WORLD.tileSize);
      p.y = clamp(p.y + stepY, 0, (WORLD.height - 1) * WORLD.tileSize);
      if (Math.abs(dx) <= speed && Math.abs(dy) <= speed) {
        p.goal = null;
        // tiny dopamine: arriving gives XP
        p.xp += 1;
        const newLevel = levelForXp(p.xp);
        if (newLevel > p.level) {
          p.level = newLevel;
          p.statPoints += 1;
          pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
        }
      }
    }
  }

  broadcast({ type: "state", state: currentState() });
}

setInterval(() => {
  // cleanup expired join codes
  const t = nowMs();
  for (const [code, rec] of joinCodes.entries()) {
    if (t > rec.expiresAt) joinCodes.delete(code);
  }
}, 2000);

setInterval(tick, WORLD.tickMs);

spawnInitialMonsters();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Clawtown running: http://localhost:${PORT}`);
});
