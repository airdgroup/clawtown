const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

const express = require("express");
const WebSocket = require("ws");
const { PNG } = require("pngjs");

const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || "127.0.0.1");

const WORLD = {
  width: 30,
  height: 18,
  tileSize: 32,
  tickMs: 100,
};

const DATA_DIR = process.env.CT_DATA_DIR || path.join(__dirname, "..", ".data");
const PLAYER_DATA_DIR = path.join(DATA_DIR, "players");
const AVATAR_DATA_DIR = path.join(DATA_DIR, "avatars");
const JOIN_CODES_DATA_PATH = path.join(DATA_DIR, "join_codes.json");
try {
  fs.mkdirSync(PLAYER_DATA_DIR, { recursive: true });
} catch {
  // ignore
}
try {
  fs.mkdirSync(AVATAR_DATA_DIR, { recursive: true });
} catch {
  // ignore
}

function playerDataPath(playerId) {
  const id = String(playerId || "").replace(/[^a-zA-Z0-9_\-]/g, "");
  return path.join(PLAYER_DATA_DIR, `${id}.json`);
}

function avatarDataPath(playerId) {
  const id = String(playerId || "").replace(/[^a-zA-Z0-9_\-]/g, "");
  return path.join(AVATAR_DATA_DIR, `${id}.png`);
}

function readJsonSafe(filePath) {
  try {
    const s = fs.readFileSync(filePath, "utf8");
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp.${process.pid}.${Math.random().toString(16).slice(2)}`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

function persistJoinCodes() {
  try {
    const out = [];
    for (const [code, rec] of joinCodes.entries()) {
      if (!code || !rec) continue;
      out.push({
        code,
        playerId: rec.playerId,
        expiresAt: rec.expiresAt,
        createdAt: Number(rec.createdAt || 0) || undefined,
      });
    }
    writeJsonAtomic(JOIN_CODES_DATA_PATH, { version: 2, savedAt: new Date().toISOString(), codes: out });
  } catch {
    // ignore
  }
}

function exportPlayerProgress(p) {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    id: p.id,
    name: p.name,
    avatarVersion: Math.max(0, Math.floor(Number(p.avatarVersion) || 0)),
    job: p.job,
    level: p.level,
    xp: p.xp,
    hp: Math.max(0, Math.floor(Number(p.hp) || 0)),
    maxHp: Math.max(1, Math.floor(Number(p.maxHp) || 1)),
    statPoints: Math.max(0, Math.floor(Number(p.statPoints) || 0)),
    baseStats: p.baseStats || null,
    zenny: Math.max(0, Math.floor(Number(p.zenny) || 0)),
    inventory: Array.isArray(p.inventory) ? p.inventory.slice(0, 200) : [],
    equipment: p.equipment || { weapon: null, armor: null, accessory: null },
    meta: p.meta || { kills: 0, crafts: 0, pickups: 0 },
    jobSkill: p.jobSkill || null,
    signatureSpell: p.signatureSpell || null,
    partyId: p.partyId || null,
  };
}

function importPlayerProgress(p, data) {
  if (!p || !data || typeof data !== "object") return;
  if (typeof data.name === "string") p.name = normalizeName(data.name);
  if (Number.isFinite(Number(data.avatarVersion))) p.avatarVersion = Math.max(0, Math.floor(Number(data.avatarVersion)));
  if (typeof data.job === "string") p.job = String(data.job);
  if (Number.isFinite(Number(data.level))) p.level = Math.max(1, Math.floor(Number(data.level)));
  if (Number.isFinite(Number(data.xp))) p.xp = Math.max(0, Math.floor(Number(data.xp)));
  if (Number.isFinite(Number(data.hp))) p.hp = Math.max(0, Math.floor(Number(data.hp)));
  if (Number.isFinite(Number(data.maxHp))) p.maxHp = Math.max(1, Math.floor(Number(data.maxHp)));
  if (Number.isFinite(Number(data.statPoints))) p.statPoints = Math.max(0, Math.floor(Number(data.statPoints)));
  if (data.baseStats && typeof data.baseStats === 'object') p.baseStats = sanitizeBaseStats(data.baseStats);
  if (Number.isFinite(Number(data.zenny))) p.zenny = Math.max(0, Math.floor(Number(data.zenny)));

  if (Array.isArray(data.inventory)) {
    p.inventory = data.inventory
      .filter((it) => it && typeof it.itemId === "string")
      .slice(0, 200)
      .map((it) => ({ itemId: String(it.itemId), qty: Math.max(1, Math.floor(Number(it.qty) || 1)) }));
  }
  if (data.equipment && typeof data.equipment === "object") {
    p.equipment = {
      weapon: data.equipment.weapon || null,
      armor: data.equipment.armor || null,
      accessory: data.equipment.accessory || null,
    };
  }
  if (data.jobSkill && typeof data.jobSkill === "object") p.jobSkill = data.jobSkill;
  if (data.signatureSpell && typeof data.signatureSpell === "object") p.signatureSpell = data.signatureSpell;
  if (data.meta && typeof data.meta === "object") {
    p.meta = {
      kills: Math.max(0, Math.floor(Number(data.meta.kills) || 0)),
      crafts: Math.max(0, Math.floor(Number(data.meta.crafts) || 0)),
      pickups: Math.max(0, Math.floor(Number(data.meta.pickups) || 0)),
    };
  }

  if (data.partyId) {
    // party is not persisted yet (social state is transient), ignore.
    p.partyId = null;
  }
}

function markDirty(p) {
  if (!p) return;
  p._dirty = true;
}

function persistPlayerIfNeeded(p, force) {
  if (!p) return;
  const now = nowMs();
  if (!p._dirty && !force) return;
  const last = Number(p._lastPersistAt || 0);
  if (!force && now - last < 5000) return;
  try {
    writeJsonAtomic(playerDataPath(p.id), exportPlayerProgress(p));
    p._dirty = false;
    p._lastPersistAt = now;
  } catch {
    // ignore
  }
}

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

function getPublicBaseUrl(req) {
  // For deployments where the externally reachable URL differs from req host
  // (e.g. frontend on Vercel, backend elsewhere, or custom reverse proxy).
  const forced = String(process.env.CT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (forced) return forced;
  return getRequestBaseUrl(req);
}

function toWsUrl(baseUrl, wsPath) {
  const wsProto = baseUrl.startsWith("https://") ? "wss://" : "ws://";
  return wsProto + baseUrl.replace(/^https?:\/\//, "") + wsPath;
}

function parseRgba(s) {
  const raw = String(s || "").trim();
  const m = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+)\s*)?\)$/i);
  if (!m) return null;
  const r = clamp(Math.floor(Number(m[1])), 0, 255);
  const g = clamp(Math.floor(Number(m[2])), 0, 255);
  const b = clamp(Math.floor(Number(m[3])), 0, 255);
  const a = m[4] == null ? 1 : clamp(Number(m[4]), 0, 1);
  return { r, g, b, a };
}

function fillRectRgba(png, x0, y0, w, h, rgba) {
  const x1 = clamp(Math.floor(x0 + w), 0, png.width);
  const y1 = clamp(Math.floor(y0 + h), 0, png.height);
  const xStart = clamp(Math.floor(x0), 0, png.width);
  const yStart = clamp(Math.floor(y0), 0, png.height);
  const a = clamp(Math.floor(Number(rgba.a) || 255), 0, 255);
  for (let y = yStart; y < y1; y++) {
    for (let x = xStart; x < x1; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = rgba.r;
      png.data[idx + 1] = rgba.g;
      png.data[idx + 2] = rgba.b;
      png.data[idx + 3] = a;
    }
  }
}

function drawDotRgba(png, cx, cy, radius, rgba) {
  const r = Math.max(1, Math.floor(Number(radius) || 1));
  const x0 = clamp(Math.floor(cx - r), 0, png.width - 1);
  const x1 = clamp(Math.floor(cx + r), 0, png.width - 1);
  const y0 = clamp(Math.floor(cy - r), 0, png.height - 1);
  const y1 = clamp(Math.floor(cy + r), 0, png.height - 1);
  const a = clamp(Math.floor(Number(rgba.a) || 255), 0, 255);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const idx = (png.width * y + x) << 2;
      png.data[idx] = rgba.r;
      png.data[idx + 1] = rgba.g;
      png.data[idx + 2] = rgba.b;
      png.data[idx + 3] = a;
    }
  }
}

function renderMinimapPng({ you, snapshot, w, h }) {
  const width = clamp(Math.floor(Number(w) || 480), 180, 1024);
  const height = clamp(Math.floor(Number(h) || 288), 120, 1024);
  const png = new PNG({ width, height });

  // Background grass.
  fillRectRgba(png, 0, 0, width, height, { r: 114, g: 201, b: 112, a: 255 });

  const worldW = WORLD.width * WORLD.tileSize;
  const worldH = WORLD.height * WORLD.tileSize;
  const sx = width / worldW;
  const sy = height / worldH;
  const toPx = (x, y) => ({ x: Math.round(x * sx), y: Math.round(y * sy) });

  // Paths + plaza + pond (simple landmarks).
  const pathY = 9 * WORLD.tileSize;
  fillRectRgba(png, 0, (pathY - 10) * sy, width, 20 * sy, { r: 217, g: 179, b: 118, a: 255 });
  const pathX = 15 * WORLD.tileSize;
  fillRectRgba(png, (pathX - 10) * sx, 0, 20 * sx, height, { r: 217, g: 179, b: 118, a: 255 });
  const plaza = { x: 13 * WORLD.tileSize, y: 7 * WORLD.tileSize, w: 4 * WORLD.tileSize, h: 4 * WORLD.tileSize };
  fillRectRgba(png, plaza.x * sx, plaza.y * sy, plaza.w * sx, plaza.h * sy, { r: 245, g: 230, b: 204, a: 255 });
  const pond = { x: 22 * WORLD.tileSize, y: 13 * WORLD.tileSize };
  const pondPx = toPx(pond.x, pond.y);
  drawDotRgba(png, pondPx.x, pondPx.y, Math.max(6, Math.round(38 * sx)), { r: 61, g: 148, b: 199, a: 220 });

  const monstersList = Array.isArray(snapshot?.monsters) ? snapshot.monsters : [];
  for (const m of monstersList) {
    if (!m || !m.alive) continue;
    const pos = toPx(m.x, m.y);
    const c = parseRgba(m.color) || { r: 250, g: 200, b: 90, a: 1 };
    drawDotRgba(png, pos.x, pos.y, 3, { r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 255) });
  }

  const playersList = Array.isArray(snapshot?.players) ? snapshot.players : [];
  for (const p of playersList) {
    if (!p) continue;
    const pos = toPx(p.x, p.y);
    const isYou = you && p.id === you.id;
    drawDotRgba(png, pos.x, pos.y, isYou ? 5 : 3, isYou ? { r: 255, g: 156, b: 69, a: 255 } : { r: 28, g: 100, b: 230, a: 220 });
  }

  return PNG.sync.write(png);
}

function renderMapPng({ you, snapshot, w, h }) {
  // Render a “map-only screenshot” (no panels) for chat apps.
  // Default size matches the full world (30*32 by 18*32).
  const worldW = WORLD.width * WORLD.tileSize;
  const worldH = WORLD.height * WORLD.tileSize;
  const width = clamp(Math.floor(Number(w) || worldW), 320, 2048);
  const height = clamp(Math.floor(Number(h) || worldH), 240, 2048);
  const png = new PNG({ width, height });

  const sx = width / worldW;
  const sy = height / worldH;
  const toPx = (x, y) => ({ x: Math.round(x * sx), y: Math.round(y * sy) });

  // Grass background with subtle checker pattern (similar vibe to the canvas).
  fillRectRgba(png, 0, 0, width, height, { r: 114, g: 201, b: 112, a: 255 });
  for (let ty = 0; ty < WORLD.height; ty++) {
    for (let tx = 0; tx < WORLD.width; tx++) {
      if ((tx + ty) % 2 !== 0) continue;
      fillRectRgba(
        png,
        tx * WORLD.tileSize * sx,
        ty * WORLD.tileSize * sy,
        WORLD.tileSize * sx,
        WORLD.tileSize * sy,
        { r: 106, g: 192, b: 104, a: 255 }
      );
    }
  }

  // Paths + plaza + pond (landmarks).
  const pathY = 9 * WORLD.tileSize;
  fillRectRgba(png, 0, (pathY - 10) * sy, width, 20 * sy, { r: 217, g: 179, b: 118, a: 255 });
  const pathX = 15 * WORLD.tileSize;
  fillRectRgba(png, (pathX - 10) * sx, 0, 20 * sx, height, { r: 217, g: 179, b: 118, a: 255 });
  const plaza = { x: 13 * WORLD.tileSize, y: 7 * WORLD.tileSize, w: 4 * WORLD.tileSize, h: 4 * WORLD.tileSize };
  fillRectRgba(png, plaza.x * sx, plaza.y * sy, plaza.w * sx, plaza.h * sy, { r: 245, g: 230, b: 204, a: 255 });
  const pond = { x: 22 * WORLD.tileSize, y: 13 * WORLD.tileSize };
  const pondPx = toPx(pond.x, pond.y);
  drawDotRgba(png, pondPx.x, pondPx.y, Math.max(16, Math.round(52 * Math.min(sx, sy))), { r: 61, g: 148, b: 199, a: 220 });

  // Drops (small squares).
  const dropsList = Array.isArray(snapshot?.drops) ? snapshot.drops : [];
  for (const d of dropsList) {
    if (!d) continue;
    const pos = toPx(d.x, d.y);
    const s = Math.max(3, Math.round(4 * Math.min(sx, sy)));
    fillRectRgba(png, pos.x - s, pos.y - s, s * 2, s * 2, { r: 250, g: 220, b: 90, a: 255 });
  }

  // Monsters.
  const monstersList = Array.isArray(snapshot?.monsters) ? snapshot.monsters : [];
  for (const m of monstersList) {
    if (!m || !m.alive) continue;
    const pos = toPx(m.x, m.y);
    const c = parseRgba(m.color) || { r: 250, g: 200, b: 90, a: 1 };
    const r = Math.max(8, Math.round(10 * Math.min(sx, sy)));
    drawDotRgba(png, pos.x, pos.y, r, { r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 255) });

    // HP bar (simple, no text).
    const hp = Math.max(0, Number(m.hp) || 0);
    const maxHp = Math.max(1, Number(m.maxHp) || 1);
    const frac = clamp(hp / maxHp, 0, 1);
    const barW = Math.max(18, Math.round(34 * sx));
    const barH = Math.max(3, Math.round(4 * sy));
    const barX = pos.x - Math.floor(barW / 2);
    const barY = pos.y - r - barH - Math.max(2, Math.round(2 * sy));
    fillRectRgba(png, barX, barY, barW, barH, { r: 20, g: 40, b: 20, a: 180 });
    fillRectRgba(png, barX, barY, Math.floor(barW * frac), barH, { r: 74, g: 209, b: 92, a: 220 });
  }

  // Players (draw after monsters so you’re visible).
  const playersList = Array.isArray(snapshot?.players) ? snapshot.players : [];
  for (const p of playersList) {
    if (!p) continue;
    const pos = toPx(p.x, p.y);
    const isYou = you && p.id === you.id;
    const r = Math.max(9, Math.round((isYou ? 12 : 10) * Math.min(sx, sy)));
    drawDotRgba(
      png,
      pos.x,
      pos.y,
      r,
      isYou ? { r: 255, g: 156, b: 69, a: 255 } : { r: 28, g: 100, b: 230, a: 230 }
    );
    if (isYou) {
      // Tiny “focus ring”.
      drawDotRgba(png, pos.x, pos.y, Math.max(1, r + 4), { r: 255, g: 240, b: 220, a: 70 });
    }
  }

  return PNG.sync.write(png);
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
const joinCodes = new Map(); // joinCode -> { playerId, expiresAt, createdAt }

const monsters = new Map(); // monsterId -> monster

const drops = new Map(); // dropId -> drop

const MAX_JOIN_CODES_PER_PLAYER = 5;
function pruneJoinCodesForPlayer(playerId) {
  const pid = String(playerId || "").trim();
  if (!pid) return;
  const list = [];
  for (const [code, rec] of joinCodes.entries()) {
    if (!rec || rec.playerId !== pid) continue;
    list.push({ code, createdAt: Number(rec.createdAt || 0) || 0, expiresAt: Number(rec.expiresAt || 0) || 0 });
  }
  if (list.length <= MAX_JOIN_CODES_PER_PLAYER) return;
  list.sort((a, b) => (a.createdAt || a.expiresAt) - (b.createdAt || b.expiresAt));
  const remove = list.slice(0, Math.max(0, list.length - MAX_JOIN_CODES_PER_PLAYER));
  for (const r of remove) joinCodes.delete(r.code);
}

const parties = new Map(); // partyId -> { id, leaderId, members:Set(playerId) }
const partyJoinCodes = new Map(); // joinCode -> { partyId, expiresAt }

function createParty(leaderId) {
  const id = randomToken('party');
  parties.set(id, { id, leaderId, members: new Set([leaderId]), lastSummonAt: 0 });
  return id;
}

function getParty(partyId) {
  const p = parties.get(String(partyId || ''));
  return p || null;
}

function playerPartyId(p) {
  return p && p.partyId ? String(p.partyId) : null;
}

function leaveParty(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return;
  for (const party of parties.values()) {
    if (!party.members.has(pid)) continue;
    party.members.delete(pid);
    // leader leaves: assign a new leader if possible
    if (party.leaderId === pid) {
      const next = party.members.values().next();
      party.leaderId = next && !next.done ? next.value : null;
    }
    if (!party.leaderId || party.members.size === 0) {
      parties.delete(party.id);
    }
    return;
  }
}

function joinParty(playerId, partyId) {
  const pid = String(playerId || '').trim();
  const party = getParty(partyId);
  if (!pid || !party) return false;
  // ensure player isn't in a party already
  leaveParty(pid);
  party.members.add(pid);
  return true;
}

function createPartyJoinCode(partyId) {
  const party = getParty(partyId);
  if (!party) return null;
  // one active code per party
  for (const [code, v] of partyJoinCodes.entries()) {
    if (v.partyId === party.id) partyJoinCodes.delete(code);
  }
  const code = randomCode(6);
  partyJoinCodes.set(code, { partyId: party.id, expiresAt: nowMs() + 5 * 60 * 1000 });
  return code;
}

function cleanupExpiredPartyCodes() {
  const t = nowMs();
  for (const [code, rec] of partyJoinCodes.entries()) {
    if (t > rec.expiresAt) partyJoinCodes.delete(code);
  }
}

function toPublicParty(party) {
  if (!party) return null;
  const members = Array.from(party.members)
    .map((id) => players.get(id))
    .filter(Boolean)
    .map((p) => ({ id: p.id, name: p.name, level: p.level, job: p.job, hp: p.hp, maxHp: p.maxHp, mode: p.mode }));
  return { id: party.id, leaderId: party.leaderId, members };
}

const ITEM_CATALOG = {
  zenny: { id: "zenny", name: "Zeny", slot: "currency", stackable: true, rarity: "common", stats: {} },

  jelly: { id: "jelly", name: "Poring Jelly", slot: "material", stackable: true, rarity: "common", stats: {} },
  leaf: { id: "leaf", name: "Green Leaf", slot: "material", stackable: true, rarity: "common", stats: {} },

  dagger_1: { id: "dagger_1", name: "Beginner Dagger", slot: "weapon", stackable: false, rarity: "common", stats: { atk: 1, aspd: 0.06, crit: 0.02 } },
  sword_1: { id: "sword_1", name: "Training Sword", slot: "weapon", stackable: false, rarity: "common", stats: { atk: 2, def: 0 } },
  bow_1: { id: "bow_1", name: "Feather Bow", slot: "weapon", stackable: false, rarity: "common", stats: { atk: 2, crit: 0.02 } },

  armor_1: { id: "armor_1", name: "Cloth Armor", slot: "armor", stackable: false, rarity: "common", stats: { def: 1 } },
  ring_1: { id: "ring_1", name: "Copper Ring", slot: "accessory", stackable: false, rarity: "common", stats: { atk: 1 } },
};

function getItemDef(itemId) {
  return ITEM_CATALOG[String(itemId || "")] || null;
}

function toPublicDrop(d) {
  const def = getItemDef(d.itemId);
  return {
    id: d.id,
    itemId: d.itemId,
    name: def ? def.name : d.itemId,
    rarity: def ? def.rarity : "common",
    x: Math.round(d.x),
    y: Math.round(d.y),
    qty: d.qty,
    expiresAt: d.expiresAt,
  };
}

function spawnDrop({ x, y, itemId, qty, byMonsterId }) {
  const def = getItemDef(itemId);
  if (!def) return null;
  const drop = {
    id: randomToken("drop"),
    createdAt: new Date().toISOString(),
    x: clamp(Number(x) || 0, 0, (WORLD.width - 1) * WORLD.tileSize),
    y: clamp(Number(y) || 0, 0, (WORLD.height - 1) * WORLD.tileSize),
    itemId: def.id,
    qty: Math.max(1, Math.floor(Number(qty) || 1)),
    byMonsterId: byMonsterId || null,
    expiresAt: nowMs() + 45_000,
  };
  drops.set(drop.id, drop);
  return drop;
}

function addToInventory(p, itemId, qty) {
  const def = getItemDef(itemId);
  if (!p || !def) return false;
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  if (!Array.isArray(p.inventory)) p.inventory = [];

  if (def.id === "zenny") {
    p.zenny = Math.max(0, Math.floor(Number(p.zenny) || 0) + n);
    markDirty(p);
    return true;
  }

  if (def.stackable) {
    const row = p.inventory.find((it) => it && it.itemId === def.id);
    if (row) row.qty = Math.max(1, Math.floor(Number(row.qty) || 1) + n);
    else p.inventory.push({ itemId: def.id, qty: n });
    markDirty(p);
    maybeAutoEquipForBot(p, def.id, 'stack pickup');
    return true;
  }

  for (let i = 0; i < n; i++) p.inventory.push({ itemId: def.id, qty: 1 });
  markDirty(p);
  maybeAutoEquipForBot(p, def.id, 'pickup');
  return true;
}

function equipItem(p, itemId) {
  const def = getItemDef(itemId);
  if (!p || !def) return { ok: false, error: "unknown item" };
  if (!['weapon', 'armor', 'accessory'].includes(def.slot)) return { ok: false, error: "not equippable" };
  if (!Array.isArray(p.inventory) || !p.inventory.some((it) => it && it.itemId === def.id)) {
    return { ok: false, error: "not owned" };
  }
  if (!p.equipment) p.equipment = { weapon: null, armor: null, accessory: null };
  const slotKey = def.slot;
  p.equipment[slotKey] = def.id;
  markDirty(p);
  return { ok: true, slot: slotKey, itemId: def.id };
}

function countInventory(p, itemId) {
  const id = String(itemId || "");
  if (!p || !Array.isArray(p.inventory) || !id) return 0;
  let total = 0;
  for (const it of p.inventory) {
    if (!it || it.itemId !== id) continue;
    total += Math.max(1, Math.floor(Number(it.qty) || 1));
  }
  return total;
}

function consumeFromInventory(p, itemId, qty) {
  const id = String(itemId || "");
  let need = Math.max(1, Math.floor(Number(qty) || 1));
  if (!p || !Array.isArray(p.inventory) || !id) return false;

  // stackable items are stored as one row; non-stackable can be multiple rows.
  for (let i = p.inventory.length - 1; i >= 0 && need > 0; i--) {
    const it = p.inventory[i];
    if (!it || it.itemId !== id) continue;
    const have = Math.max(1, Math.floor(Number(it.qty) || 1));
    if (have <= need) {
      need -= have;
      p.inventory.splice(i, 1);
    } else {
      it.qty = have - need;
      need = 0;
    }
  }

  const ok = need === 0;
  if (ok) markDirty(p);
  return ok;
}

function rollCraftReward() {
  const table = [
    { itemId: "dagger_1", w: 35 },
    { itemId: "sword_1", w: 30 },
    { itemId: "bow_1", w: 20 },
    { itemId: "armor_1", w: 10 },
    { itemId: "ring_1", w: 5 },
  ];
  const sum = table.reduce((s, r) => s + r.w, 0);
  let r = Math.random() * sum;
  for (const row of table) {
    r -= row.w;
    if (r <= 0) return row.itemId;
  }
  return "dagger_1";
}

function itemScoreForSlot(def) {
  if (!def || !def.stats) return 0;
  const s = def.stats;
  const atk = Number(s.atk || 0);
  const defv = Number(s.def || 0);
  const crit = Number(s.crit || 0);
  const aspd = Number(s.aspd || 0);
  // v1 heuristic: prefer raw ATK early (RO-ish feeling)
  return atk * 100 + defv * 40 + crit * 30 + aspd * 20;
}

function maybeAutoEquipForBot(p, itemId, reason) {
  if (!p || !p.linkedBot) return;
  const def = getItemDef(itemId);
  if (!def || !['weapon', 'armor', 'accessory'].includes(def.slot)) return;
  if (!p.equipment) p.equipment = { weapon: null, armor: null, accessory: null };

  const slot = def.slot;
  const cur = getItemDef(p.equipment[slot]);
  const curScore = itemScoreForSlot(cur);
  const newScore = itemScoreForSlot(def);
  if (newScore <= curScore) return;

  const out = equipItem(p, def.id);
  if (!out.ok) return;

  const prevName = cur ? cur.name : '—';
  const why = reason ? ` (${reason})` : '';
  pushChat({
    kind: 'chat',
    text: `[BOT] Equipped ${def.name} instead of ${prevName}${why}.`,
    from: { id: p.id, name: p.name },
  });
}

function defaultBaseStats() {
  return { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
}

function sanitizeBaseStats(obj) {
  const raw = obj && typeof obj === 'object' ? obj : {};
  const out = defaultBaseStats();
  for (const k of Object.keys(out)) {
    const v = Number(raw[k]);
    if (Number.isFinite(v)) out[k] = clamp(Math.floor(v), 1, 99);
  }
  return out;
}

function ensurePlayerVitals(p, opts) {
  if (!p) return;
  const base = sanitizeBaseStats(p.baseStats);
  p.baseStats = base;

  const level = Math.max(1, Math.floor(Number(p.level) || 1));
  const vit = Math.max(1, Math.floor(Number(base.vit) || 1));
  const computedMaxHp = Math.max(1, 30 + (level - 1) * 2 + (vit - 1) * 3);
  const prevMaxHp = Math.max(1, Math.floor(Number(p.maxHp) || 1));
  const nextMaxHp = Math.max(prevMaxHp, computedMaxHp);
  if (nextMaxHp !== prevMaxHp) {
    p.maxHp = nextMaxHp;
    if (opts && opts.gainHpFromMaxHpIncrease) {
      const prevHp = Math.max(0, Math.floor(Number(p.hp) || 0));
      const delta = nextMaxHp - prevMaxHp;
      p.hp = Math.min(nextMaxHp, prevHp + delta);
    }
  }

  // Safety clamp.
  p.hp = clamp(Math.floor(Number(p.hp) || 0), 0, Math.floor(Number(p.maxHp) || nextMaxHp));
}

function playerStats(p) {
  const base = sanitizeBaseStats(p && p.baseStats);
  const equip = p && p.equipment ? p.equipment : {};
  const weapon = getItemDef(equip.weapon);
  const armor = getItemDef(equip.armor);
  const acc = getItemDef(equip.accessory);

  const statFrom = (def) => (def && def.stats ? def.stats : {});
  const w = statFrom(weapon);
  const a = statFrom(armor);
  const r = statFrom(acc);

  const atkBase =
    p.job === "mage" ? 3 :
      p.job === "archer" ? 3 :
        p.job === "knight" ? 4 :
          p.job === "assassin" ? 3 :
            p.job === "bard" ? 2 : 2;

  const strAtk = Math.max(0, Math.floor((base.str || 1) - 1));
  const dexAtk = p.job === 'archer' ? Math.floor(Math.max(0, (base.dex || 1) - 1) / 2) : 0;
  const vitDef = Math.floor(Math.max(0, (base.vit || 1) - 1) / 2);
  const lukCrit = Math.max(0, Math.floor((base.luk || 1) - 1)) * 0.01;
  const agiAspd = Math.max(0, Math.floor((base.agi || 1) - 1)) * 0.01;

  const atk = atkBase + strAtk + dexAtk + (w.atk || 0) + (a.atk || 0) + (r.atk || 0);
  const def = vitDef + (a.def || 0) + (w.def || 0) + (r.def || 0);
  const crit = clamp((w.crit || 0) + (a.crit || 0) + (r.crit || 0) + lukCrit, 0, 0.8);
  const aspd = clamp((w.aspd || 0) + (a.aspd || 0) + (r.aspd || 0) + agiAspd, 0, 0.8);
  return { atk, def, crit, aspd };
}

const boardPosts = []; // newest last
const chats = []; // newest last
const fxEvents = []; // ephemeral; stored briefly for late join

// Join codes are meant to be re-usable across chat sessions and should survive server restarts.
// We keep them in-memory for speed and persist the small map to disk.
try {
  const saved = readJsonSafe(JOIN_CODES_DATA_PATH);
  const list = Array.isArray(saved?.codes) ? saved.codes : [];
  for (const row of list) {
    const code = String(row?.code || "").trim().toUpperCase();
    const playerId = String(row?.playerId || "").trim();
    const expiresAt = Number(row?.expiresAt || 0);
    const createdAt = Number(row?.createdAt || 0);
    if (!code || !playerId || !Number.isFinite(expiresAt)) continue;
    if (nowMs() > expiresAt) continue;
    const approxCreatedAt = expiresAt - 24 * 60 * 60 * 1000; // v2 introduced createdAt; v1 is assumed 24h TTL
    joinCodes.set(code, {
      playerId,
      expiresAt,
      createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : approxCreatedAt,
    });
  }
} catch {
  // ignore
}

let emitFx = () => {};

function getOrCreatePlayer(playerId, name) {
  const id = String(playerId || "").trim();
  if (!id) return null;
  let p = players.get(id);
  if (!p) {
    const saved = readJsonSafe(playerDataPath(id));
    p = {
      id,
      name: normalizeName(name) || (saved && saved.name) || "Anonymous",
      avatarVersion: 0,
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
      zenny: 0,
      inventory: [],
      equipment: { weapon: null, armor: null, accessory: null },
      meta: { kills: 0, crafts: 0, pickups: 0 },
      statPoints: 5,
      baseStats: defaultBaseStats(),
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
      externalBotLastSeenAt: 0,
      externalBotLastActionAt: 0,
      _autoBotAt: 0,
      _autoBotThoughtAt: 0,
      _autoBotState: "",
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
      partyId: null,
      _dirty: false,
      _lastPersistAt: 0,
    };

    if (saved) {
      importPlayerProgress(p, saved);
      // ensure defaults
      if (!p.jobSkill) p.jobSkill = defaultJobSkillForJob(p.job);
      if (!p.signatureSpell) p.signatureSpell = { name: "", tagline: "", effect: "spark" };
    }

    ensurePlayerVitals(p, { gainHpFromMaxHpIncrease: false });

    players.set(id, p);
    pushChat({
      kind: "system",
      text: `${p.name} entered the town.`,
      from: { id: "system", name: "Town" },
    });
    // persist new player soon
    markDirty(p);
    persistPlayerIfNeeded(p, true);
  } else if (name) {
    p.name = normalizeName(name);
    markDirty(p);
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
  ensurePlayerVitals(p, { gainHpFromMaxHpIncrease: false });
  return {
    id: p.id,
    name: p.name,
    avatarVersion: Math.max(0, Math.floor(Number(p.avatarVersion) || 0)),
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
    baseStats: sanitizeBaseStats(p.baseStats),
    zenny: Math.max(0, Math.floor(Number(p.zenny) || 0)),
    stats: playerStats(p),
    meta: p.meta || { kills: 0, crafts: 0, pickups: 0 },
    partyId: p.partyId || null,
    job: p.job,
    equipment: {
      weapon: p.equipment?.weapon || null,
      armor: p.equipment?.armor || null,
      accessory: p.equipment?.accessory || null,
    },
    inventory: (Array.isArray(p.inventory) ? p.inventory : []).slice(0, 80).map((it) => {
      const def = getItemDef(it?.itemId);
      return {
        itemId: def ? def.id : String(it?.itemId || ""),
        name: def ? def.name : String(it?.itemId || ""),
        slot: def ? def.slot : "material",
        rarity: def ? def.rarity : "common",
        qty: Math.max(1, Math.floor(Number(it?.qty) || 1)),
        stats: def ? def.stats : {},
      };
    }),
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
    bot: {
      lastSeenAt: Number(p.externalBotLastSeenAt || 0) || null,
      lastActionAt: Number(p.externalBotLastActionAt || 0) || null,
    },
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
    color: m.color || null,
  };
}

function spawnInitialMonsters() {
  if (monsters.size > 0) return;

  const make = (id, kind, name, x, y, maxHp, color) => {
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
      color: color || null,
      vx: Math.random() < 0.5 ? -1 : 1,
      vy: Math.random() < 0.5 ? -1 : 1,
      nextWanderAt: nowMs() + 500 + Math.floor(Math.random() * 1500),
    });
  };

  // Put slimes near the spawn plaza so v1 feels alive.
  // Colors are chosen to harmonize with the sky/grass palette while staying readable.
  make("m_slime_1", "slime", "Poring", 13 * WORLD.tileSize + 28, 9 * WORLD.tileSize + 18, 18, "rgba(251, 182, 206, 0.9)");
  make("m_slime_2", "slime", "Drops", 17 * WORLD.tileSize + 18, 9 * WORLD.tileSize + 6, 14, "rgba(125, 211, 252, 0.9)");
  make("m_slime_3", "slime", "Poporing", 15 * WORLD.tileSize + 70, 11 * WORLD.tileSize + 18, 20, "rgba(134, 239, 172, 0.9)");
  make("m_slime_4", "slime", "Marin", 12 * WORLD.tileSize + 18, 11 * WORLD.tileSize + 26, 16, "rgba(94, 234, 212, 0.9)");
  make("m_slime_5", "slime", "Metaling", 18 * WORLD.tileSize + 22, 7 * WORLD.tileSize + 18, 22, "rgba(252, 211, 77, 0.92)");
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

    if (m.kind === 'elite') {
      // elites don't wander (v1)
      continue;
    }

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
  const st = playerStats(p);
  return Math.max(1, Math.floor(st.atk));
}

function rollSlimeLoot() {
  // v1 simple table
  const out = [];
  // always a bit of zeny
  out.push({ itemId: "zenny", qty: 1 + Math.floor(Math.random() * 3) });
  const r = Math.random();
  if (r < 0.55) out.push({ itemId: "jelly", qty: 1 });
  if (r < 0.22) out.push({ itemId: "leaf", qty: 1 });
  if (r < 0.12) out.push({ itemId: "dagger_1", qty: 1 });
  if (r < 0.07) out.push({ itemId: "armor_1", qty: 1 });
  if (r < 0.04) out.push({ itemId: "ring_1", qty: 1 });
  return out;
}

function rollEliteLoot() {
  const out = [];
  out.push({ itemId: "zenny", qty: 12 + Math.floor(Math.random() * 10) });
  out.push({ itemId: "jelly", qty: 2 + Math.floor(Math.random() * 2) });
  // guaranteed one equipment
  const eq = ["sword_1", "bow_1", "armor_1", "ring_1"];
  out.push({ itemId: eq[Math.floor(Math.random() * eq.length)], qty: 1 });
  // small chance extra
  if (Math.random() < 0.25) out.push({ itemId: "dagger_1", qty: 1 });
  return out;
}

function maybeDropLoot(p, m) {
  if (!p || !m) return;
  const items = m.kind === "elite" ? rollEliteLoot() : m.kind === "slime" ? rollSlimeLoot() : [];
  for (const it of items) {
    spawnDrop({ x: m.x + (Math.random() - 0.5) * 16, y: m.y + (Math.random() - 0.5) * 16, itemId: it.itemId, qty: it.qty, byMonsterId: m.id });
  }
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

    // Party share: nearby party members also get the kill dopamine.
    const baseXp = m.kind === 'elite' ? 30 : 8;
    const shareR2 = Math.pow(8 * WORLD.tileSize, 2);
    const killers = [];
    if (p && p.partyId) {
      const party = getParty(p.partyId);
      if (party) {
        for (const mid of party.members) {
          const mp = players.get(mid);
          if (!mp) continue;
          if (dist2(mp.x, mp.y, m.x, m.y) > shareR2) continue;
          killers.push(mp);
        }
      }
    }
    if (killers.length === 0) killers.push(p);

    for (const kp of killers) {
      maybeDropLoot(kp, m);
      if (!kp.meta) kp.meta = { kills: 0, crafts: 0, pickups: 0 };
      kp.meta.kills = Math.max(0, Math.floor(Number(kp.meta.kills) || 0) + 1);
      kp.xp += baseXp;
      markDirty(kp);
      const newLevel = levelForXp(kp.xp);
      if (newLevel > kp.level) {
        const prevLevel = kp.level;
        kp.level = newLevel;
        kp.statPoints += Math.max(0, newLevel - prevLevel);
        ensurePlayerVitals(kp, { gainHpFromMaxHpIncrease: true });
        kp.hp = kp.maxHp;
        pushChat({ kind: "system", text: `${kp.name} reached Level ${kp.level}!`, from: { id: "system", name: "Town" } });
        markDirty(kp);
      }
    }

    pushChat({ kind: "system", text: `${p.name} defeated ${m.name}! (+${baseXp} XP)`, from: { id: "system", name: "Town" } });
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

    // Make it feel directional but forgiving: pick a target in a "corridor" in front.
    const corridor = 90;
    let m = null;
    let best = range + 1;
    for (const mm of monsters.values()) {
      if (!mm.alive) continue;
      const dx = mm.x - p.x;
      const dy = mm.y - p.y;
      if (facing === "left") {
        if (dx >= -6) continue;
        if (Math.abs(dy) > corridor) continue;
        const dist = Math.abs(dx);
        if (dist <= range && dist < best) {
          best = dist;
          m = mm;
        }
        continue;
      }
      if (facing === "right") {
        if (dx <= 6) continue;
        if (Math.abs(dy) > corridor) continue;
        const dist = Math.abs(dx);
        if (dist <= range && dist < best) {
          best = dist;
          m = mm;
        }
        continue;
      }
      if (facing === "up") {
        if (dy >= -6) continue;
        if (Math.abs(dx) > corridor) continue;
        const dist = Math.abs(dy);
        if (dist <= range && dist < best) {
          best = dist;
          m = mm;
        }
        continue;
      }
      // down
      if (dy <= 6) continue;
      if (Math.abs(dx) > corridor) continue;
      const dist = Math.abs(dy);
      if (dist <= range && dist < best) {
        best = dist;
        m = mm;
      }
    }

    const end = {
      x: facing === "left" ? p.x - range : facing === "right" ? p.x + range : p.x,
      y: facing === "up" ? p.y - range : facing === "down" ? p.y + range : p.y,
    };

    if (!m) {
      pushFx({
        type: "arrow",
        x: end.x,
        y: end.y,
        byPlayerId: p.id,
        payload: { miss: true, fromX: p.x, fromY: p.y, toX: end.x, toY: end.y, facing, source },
      });
      return { ok: false, reason: "no target" };
    }

    const dmg = Math.max(2, damageForPlayer(p));
    const out = applyDamage(p, m, dmg);
    pushFx({
      type: "arrow",
      x: m.x,
      y: m.y,
      byPlayerId: p.id,
      payload: { target: m.id, dmg: out.dealt, fromX: p.x, fromY: p.y, toX: m.x, toY: m.y, facing, source },
    });
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
  markDirty(p);
  if (result.signature) {
    p.signatureSpell = {
      name: safeText(result.signature.name || "", 48),
      tagline: safeText(result.signature.tagline || "", 140),
      effect: String(result.signature.effect || "spark"),
    };
    markDirty(p);
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
  p.externalBotLastSeenAt = nowMs();
  return { token, player: p };
}

function canAutopilot(p) {
  if (!p) return false;
  if (p.mode !== 'agent') return false;
  if (!p.linkedBot) return false;
  const lastSeen = Number(p.externalBotLastSeenAt || 0);
  // If an external bot is polling recently, assume it is in control.
  return nowMs() - lastSeen > 8000;
}

function maybeAutopilot(p) {
  if (!canAutopilot(p)) return;
  const now = nowMs();
  const last = Number(p._autoBotAt || 0);
  if (now - last < 900) return;
  p._autoBotAt = now;

  const say = (text) => {
    const gap = now - Number(p._autoBotThoughtAt || 0);
    if (gap < 2500) return;
    p._autoBotThoughtAt = now;
    pushChat({ kind: 'chat', text: `[BOT] ${text}`, from: { id: p.id, name: p.name } });
  };

  // Prioritize nearby monsters.
  const huntRange = 520;
  const hitRange = 140;
  const target = findNearestAliveMonster(p.x, p.y, huntRange);
  if (target) {
    const d2 = dist2(p.x, p.y, target.x, target.y);
    if (d2 <= hitRange * hitRange) {
      performCast(p, { spell: 'signature', source: 'autopilot' });
      if (p._autoBotState !== `hit:${target.id}`) {
        p._autoBotState = `hit:${target.id}`;
        say(`攻擊 ${target.name}。`);
      }
      return;
    }
    if (!p.goal) {
      p.goal = { x: target.x, y: target.y };
      if (p._autoBotState !== `hunt:${target.id}`) {
        p._autoBotState = `hunt:${target.id}`;
        say(`看到 ${target.name}，靠近準備攻擊。`);
      }
    }
    return;
  }

  // No monsters: wander near plaza.
  if (!p.goal) {
    const px = 15 * WORLD.tileSize + 32;
    const py = 10 * WORLD.tileSize + 16;
    const j = () => (Math.random() - 0.5) * 220;
    p.goal = {
      x: clamp(px + j(), 0, (WORLD.width - 1) * WORLD.tileSize),
      y: clamp(py + j(), 0, (WORLD.height - 1) * WORLD.tileSize),
    };
    if (p._autoBotState !== 'wander') {
      p._autoBotState = 'wander';
      say('巡邏廣場中。');
    }
  }
}

const app = express();
app.use(express.json({ limit: "256kb" }));

if (String(process.env.CT_TEST || "").trim() === "1") {
  app.post("/api/debug/reset", (_req, res) => {
    players.clear();
    botTokens.clear();
    joinCodes.clear();
    monsters.clear();
    drops.clear();
    boardPosts.length = 0;
    chats.length = 0;
    fxEvents.length = 0;

    try {
      if (fs.existsSync(PLAYER_DATA_DIR)) {
        for (const f of fs.readdirSync(PLAYER_DATA_DIR)) {
          if (f.endsWith('.json')) {
            try { fs.unlinkSync(path.join(PLAYER_DATA_DIR, f)); } catch { /* ignore */ }
          }
        }
      }
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(AVATAR_DATA_DIR)) {
        for (const f of fs.readdirSync(AVATAR_DATA_DIR)) {
          if (f.endsWith('.png')) {
            try { fs.unlinkSync(path.join(AVATAR_DATA_DIR, f)); } catch { /* ignore */ }
          }
        }
      }
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(JOIN_CODES_DATA_PATH)) fs.unlinkSync(JOIN_CODES_DATA_PATH);
    } catch {
      // ignore
    }

    spawnInitialMonsters();
    res.json({ ok: true });
  });

  app.post("/api/debug/persist-flush", (req, res) => {
    const playerId = String(req.body?.playerId || "").trim();
    if (playerId) {
      const p = players.get(playerId);
      if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });
      persistPlayerIfNeeded(p, true);
      return res.json({ ok: true });
    }
    for (const p of players.values()) persistPlayerIfNeeded(p, true);
    res.json({ ok: true });
  });

  app.post("/api/debug/restart-sim", (_req, res) => {
    // Simulate a server restart: persist then clear in-memory state (but keep player data on disk).
    for (const p of players.values()) persistPlayerIfNeeded(p, true);
    players.clear();
    botTokens.clear();
    joinCodes.clear();
    persistJoinCodes();
    monsters.clear();
    drops.clear();
    boardPosts.length = 0;
    chats.length = 0;
    fxEvents.length = 0;
    spawnInitialMonsters();
    res.json({ ok: true });
  });

  app.post("/api/debug/teleport", (req, res) => {
    const playerId = String(req.body?.playerId || "").trim();
    const p = players.get(playerId);
    if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ ok: false, error: "invalid coords" });
    p.x = clamp(x, 0, (WORLD.width - 1) * WORLD.tileSize);
    p.y = clamp(y, 0, (WORLD.height - 1) * WORLD.tileSize);
    p.goal = null;
    res.json({ ok: true });
  });

  app.post("/api/debug/spawn-monster", (req, res) => {
    const id = String(req.body?.id || randomToken("m")).trim();
    const kind = String(req.body?.kind || "slime").trim().toLowerCase();
    const name = safeText(req.body?.name || (kind === "slime" ? "Poring" : "Monster"), 24);
    const color = safeText(req.body?.color || "", 32);
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    const maxHp = Math.max(1, Math.floor(Number(req.body?.maxHp || 10)));
    const hp = Math.max(0, Math.floor(Number(req.body?.hp || maxHp)));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ ok: false, error: "invalid coords" });
    monsters.set(id, {
      id,
      kind,
      name,
      x: clamp(x, 0, (WORLD.width - 1) * WORLD.tileSize),
      y: clamp(y, 0, (WORLD.height - 1) * WORLD.tileSize),
      hp,
      maxHp,
      alive: hp > 0,
      respawnAt: null,
      color: color || null,
      vx: 0,
      vy: 0,
      nextWanderAt: nowMs() + 5000,
    });
    res.json({ ok: true, id });
  });

  app.post("/api/debug/grant-item", (req, res) => {
    const playerId = String(req.body?.playerId || "").trim();
    const p = players.get(playerId);
    if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });
    const itemId = String(req.body?.itemId || "").trim();
    const qty = Number(req.body?.qty || 1);
    const def = getItemDef(itemId);
    if (!def) return res.status(400).json({ ok: false, error: "unknown itemId" });
    addToInventory(p, def.id, qty);
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

app.get("/api/avatars/:playerId.png", (req, res) => {
  const playerId = String(req.params?.playerId || "").trim();
  if (!playerId) return res.status(400).end();
  const filePath = avatarDataPath(playerId);
  try {
    if (!fs.existsSync(filePath)) return res.status(404).end();
    const buf = fs.readFileSync(filePath);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(buf);
  } catch {
    res.status(500).end();
  }
});

app.post("/api/players/avatar", (req, res) => {
  const playerId = String(req.body?.playerId || "").trim();
  if (!playerId) return res.status(400).json({ ok: false, error: "missing playerId" });
  const p = players.get(playerId);
  if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });

  const reset = Boolean(req.body?.reset);
  if (reset) {
    p.avatarVersion = 0;
    markDirty(p);
    try {
      const fp = avatarDataPath(playerId);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {
      // ignore
    }
    persistPlayerIfNeeded(p, true);
    return res.json({ ok: true, avatarVersion: 0 });
  }

  const pngDataUrl = String(req.body?.pngDataUrl || "").trim();
  if (!pngDataUrl) return res.status(400).json({ ok: false, error: "missing pngDataUrl" });
  const m = pngDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return res.status(400).json({ ok: false, error: "expected data:image/png;base64" });
  let buf;
  try {
    buf = Buffer.from(m[1], "base64");
  } catch {
    return res.status(400).json({ ok: false, error: "invalid base64" });
  }

  // Guardrails: keep it small and ensure it's actually a PNG.
  if (!buf || buf.length < 16) return res.status(400).json({ ok: false, error: "invalid png" });
  if (buf.length > 220 * 1024) return res.status(413).json({ ok: false, error: "avatar too large" });
  const sig = buf.slice(0, 8);
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!sig.equals(pngSig)) return res.status(400).json({ ok: false, error: "not a png" });

  try {
    const fp = avatarDataPath(playerId);
    const tmp = `${fp}.tmp.${process.pid}.${Math.random().toString(16).slice(2)}`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, fp);
  } catch {
    return res.status(500).json({ ok: false, error: "failed to save avatar" });
  }

  p.avatarVersion = nowMs();
  markDirty(p);
  persistPlayerIfNeeded(p, true);
  res.json({ ok: true, avatarVersion: p.avatarVersion });
});

app.post("/api/join-codes", (req, res) => {
  const { playerId } = req.body || {};
  const p = players.get(String(playerId || "").trim());
  if (!p) return res.status(404).json({ ok: false, error: "unknown playerId" });

  // Cleanup expired codes (best-effort).
  try {
    for (const [c, r] of joinCodes.entries()) {
      if (!r || nowMs() > Number(r.expiresAt || 0)) joinCodes.delete(c);
    }
    persistJoinCodes();
  } catch {
    // ignore
  }

  const joinCode = randomCode(6);
  // Join tokens should be re-usable across chat sessions. Users may paste the same join token
  // into a new Telegram/WhatsApp session to re-link and query status.
  const expiresAt = nowMs() + 24 * 60 * 60 * 1000; // 24h
  joinCodes.set(joinCode, { playerId: p.id, expiresAt, createdAt: nowMs() });
  pruneJoinCodesForPlayer(p.id);
  persistJoinCodes();

  const baseUrl = getPublicBaseUrl(req);
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
    persistJoinCodes();
    return res.status(410).json({ ok: false, error: "joinCode expired" });
  }

  const p = players.get(rec.playerId);
  if (!p) return res.status(404).json({ ok: false, error: "player missing" });

  // If this player already has a botToken, return it to allow “re-link” from a new chat session
  // without breaking the currently running bot loop.
  let botToken = null;
  for (const [t, pid] of botTokens.entries()) {
    if (pid === p.id) {
      botToken = t;
      break;
    }
  }
  if (!botToken) {
    botToken = randomToken("ctbot");
    botTokens.set(botToken, p.id);
  }
  p.linkedBot = true;

  pushChat({
    kind: "system",
    text: `${p.name}'s CloudBot is now linked.`,
    from: { id: "system", name: "Town" },
  });

  res.json({
    ok: true,
    botToken,
    playerId: p.id,
    apiBaseUrl: getPublicBaseUrl(req),
    wsUrl: toWsUrl(getPublicBaseUrl(req), "/ws"),
  });
});

app.get("/api/bot/me", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json({ ok: true, player: toPublicPlayer(auth.player) });
});

// A concise, bot-friendly status endpoint for “pet updates” in chat apps.
// (level/hp/gear/location + nearby counts). Use /api/bot/minimap.png for an image.
app.get("/api/bot/status", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  p.externalBotLastActionAt = nowMs();

  const r2 = Math.pow(6 * WORLD.tileSize, 2);
  const nearbyPlayers = Array.from(players.values()).filter((pp) => pp.id !== p.id && dist2(pp.x, pp.y, p.x, p.y) <= r2).length;
  const nearbyMonsters = Array.from(monsters.values()).filter((m) => m.alive && dist2(m.x, m.y, p.x, p.y) <= r2).length;
  const nearbyDrops = Array.from(drops.values()).filter((d) => dist2(d.x, d.y, p.x, p.y) <= r2).length;

  res.json({
    ok: true,
    time: new Date().toISOString(),
    you: toPublicPlayer(p),
    nearby: {
      players: nearbyPlayers,
      monsters: nearbyMonsters,
      drops: nearbyDrops,
      radiusTiles: 6,
    },
  });
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
    drops: Array.from(drops.values()).map(toPublicDrop),
    parties: Array.from(parties.values()).map(toPublicParty).filter(Boolean),
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

app.get("/api/bot/minimap.png", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).end();
  const p = auth.player;
  p.externalBotLastActionAt = nowMs();
  const snapshot = currentState();
  const buf = renderMinimapPng({ you: p, snapshot, w: req.query?.w, h: req.query?.h });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
});

app.get("/api/bot/map.png", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).end();
  const p = auth.player;
  p.externalBotLastActionAt = nowMs();
  const snapshot = currentState();
  const buf = renderMapPng({ you: p, snapshot, w: req.query?.w, h: req.query?.h });
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.end(buf);
});

app.post("/api/bot/mode", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const mode = String(req.body?.mode || "").toLowerCase();
  if (!['manual', 'agent'].includes(mode)) return res.status(400).json({ ok: false, error: "invalid mode" });
  auth.player.mode = mode;
  if (mode === "manual") auth.player.goal = null;
  auth.player.externalBotLastActionAt = nowMs();
  res.json({ ok: true, player: toPublicPlayer(auth.player) });
});

app.post("/api/bot/party/create", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  if (p.partyId) return res.json({ ok: true, partyId: p.partyId });
  const id = createParty(p.id);
  p.partyId = id;
  markDirty(p);
  res.json({ ok: true, partyId: id });
});

app.post("/api/bot/party/code", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  if (!p.partyId) return res.status(400).json({ ok: false, error: "not in party" });
  const party = getParty(p.partyId);
  if (!party) return res.status(404).json({ ok: false, error: "party missing" });
  if (party.leaderId !== p.id) return res.status(403).json({ ok: false, error: "not leader" });
  const code = createPartyJoinCode(p.partyId);
  res.json({ ok: true, joinCode: code, expiresAt: partyJoinCodes.get(code).expiresAt });
});

app.post("/api/bot/party/join", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const code = String(req.body?.joinCode || "").trim();
  const rec = partyJoinCodes.get(code);
  if (!rec) return res.status(400).json({ ok: false, error: "invalid code" });
  if (nowMs() > rec.expiresAt) {
    partyJoinCodes.delete(code);
    return res.status(400).json({ ok: false, error: "expired code" });
  }
  const ok = joinParty(auth.player.id, rec.partyId);
  if (!ok) return res.status(404).json({ ok: false, error: "party missing" });
  auth.player.partyId = rec.partyId;
  markDirty(auth.player);
  res.json({ ok: true, partyId: rec.partyId });
});

app.post("/api/bot/party/leave", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  if (!p.partyId) return res.json({ ok: true });
  leaveParty(p.id);
  p.partyId = null;
  markDirty(p);
  res.json({ ok: true });
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
  auth.player.externalBotLastActionAt = nowMs();
  res.json({ ok: true });
});

app.post("/api/bot/intent", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  auth.player.intent = safeText(req.body?.text || "", 200);
  auth.player.externalBotLastActionAt = nowMs();
  res.json({ ok: true });
});

app.post("/api/bot/chat", (req, res) => {
  const auth = authBot(req);
  if (!auth) return res.status(401).json({ ok: false, error: "unauthorized" });
  const p = auth.player;
  const t = nowMs();
  if (t - p.lastChatAt < 1200) return res.status(429).json({ ok: false, error: "rate limited" });
  p.lastChatAt = t;
  p.externalBotLastActionAt = t;
  pushChat({ kind: "chat", text: req.body?.text, from: { id: p.id, name: p.name } });
  p.xp += 1;
  markDirty(p);
  const newLevel = levelForXp(p.xp);
  if (newLevel > p.level) {
    const prevLevel = p.level;
    p.level = newLevel;
    p.statPoints += Math.max(0, newLevel - prevLevel);
    ensurePlayerVitals(p, { gainHpFromMaxHpIncrease: true });
    pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
    markDirty(p);
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
  p.externalBotLastActionAt = nowMs();
  const spell = req.body?.spell;
  const x = req.body?.x;
  const y = req.body?.y;
  const resolvedSpell = spell === "job" ? p.jobSkill?.spell : spell;
  const out = performCast(p, { spell: resolvedSpell, x, y, source: "bot" });
  res.json({ ok: true, result: out });
});

// Expose minimal runtime flags to the client without turning the static HTML into a template.
app.get("/env.js", (_req, res) => {
  const env = {
    ctTest: String(process.env.CT_TEST || "") === "1",
  };
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`window.__CT_ENV__ = ${JSON.stringify(env)};`);
});

app.use(
  express.static(path.join(__dirname, "..", "public"), {
    setHeaders(res, filePath) {
      // Avoid “stale JS” issues during rapid iteration / deploys.
      // We can revisit long-term caching once we add proper asset versioning.
      const base = path.basename(String(filePath || ""));
      if (base === "index.html" || base === "app.js" || base === "styles.css" || base === "skill.md" || base === "skill.json") {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

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
    drops: Array.from(drops.values()).map(toPublicDrop),
    parties: Array.from(parties.values()).map(toPublicParty).filter(Boolean),
    board: boardPosts.slice(-20),
    chats: chats.slice(-35),
  };
}

function tryAutoPickup(p) {
  if (!p) return;
  const pickupR2 = Math.pow(22, 2);
  const t = nowMs();

  for (const [id, d] of drops.entries()) {
    if (d.expiresAt && t > d.expiresAt) {
      drops.delete(id);
      continue;
    }
    if (dist2(p.x, p.y, d.x, d.y) > pickupR2) continue;

    // pick up
    drops.delete(id);
    addToInventory(p, d.itemId, d.qty);
    if (!p.meta) p.meta = { kills: 0, crafts: 0, pickups: 0 };
    p.meta.pickups = Math.max(0, Math.floor(Number(p.meta.pickups) || 0) + 1);
    markDirty(p);
    const def = getItemDef(d.itemId);
    const name = def ? def.name : d.itemId;
    pushChat({ kind: "system", text: `${p.name} picked up ${name}${d.qty > 1 ? ` x${d.qty}` : ""}.`, from: { id: "system", name: "Town" } });
    // tiny dopamine
    p.xp += 1;
    markDirty(p);
    const newLevel = levelForXp(p.xp);
    if (newLevel > p.level) {
      const prevLevel = p.level;
      p.level = newLevel;
      p.statPoints += Math.max(0, newLevel - prevLevel);
      ensurePlayerVitals(p, { gainHpFromMaxHpIncrease: true });
      pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
      markDirty(p);
    }
    // allow multiple pickups per tick
  }
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
      markDirty(player);
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
      markDirty(player);
      return;
    }

    if (type === "set_job_skill") {
      const name = safeText(msg?.name || "", 48);
      const spellRaw = String(msg?.spell || "signature").trim().toLowerCase();
      const allowed = new Set(["signature", "fireball", "hail", "arrow", "cleave", "flurry"]);
      const spell = allowed.has(spellRaw) ? spellRaw : "signature";
      player.jobSkill = { name, spell };
      markDirty(player);
      return;
    }

    if (type === "equip") {
      const itemId = String(msg?.itemId || "").trim();
      if (!itemId) return;
      const out = equipItem(player, itemId);
      if (out.ok) {
        const def = getItemDef(itemId);
        pushChat({ kind: "system", text: `${player.name} equipped ${def ? def.name : itemId}.`, from: { id: "system", name: "Town" } });
      }
      return;
    }

    if (type === "alloc_stat") {
      const stat = String(msg?.stat || "").trim().toLowerCase();
      const allowed = new Set(["str", "agi", "vit", "int", "dex", "luk"]);
      if (!allowed.has(stat)) return;
      const n = clamp(Math.floor(Number(msg?.n || 1)), 1, 99);
      if (Number(player.statPoints || 0) < n) return;

      player.baseStats = sanitizeBaseStats(player.baseStats);
      player.baseStats[stat] = clamp(Math.floor(Number(player.baseStats[stat] || 1)) + n, 1, 99);
      player.statPoints = Math.max(0, Math.floor(Number(player.statPoints) || 0) - n);
      ensurePlayerVitals(player, { gainHpFromMaxHpIncrease: true });
      markDirty(player);
      return;
    }

    if (type === "craft") {
      const recipe = String(msg?.recipe || "").trim();
      if (recipe !== "jelly_3") return;
      const have = countInventory(player, "jelly");
      if (have < 3) {
        pushChat({ kind: "system", text: `${player.name} needs 3 Poring Jelly to craft.`, from: { id: "system", name: "Town" }, toPlayerId: player.id });
        return;
      }
      const ok = consumeFromInventory(player, "jelly", 3);
      if (!ok) return;
      const rewardId = rollCraftReward();
      addToInventory(player, rewardId, 1);
      maybeAutoEquipForBot(player, rewardId, 'crafted');
      if (!player.meta) player.meta = { kills: 0, crafts: 0, pickups: 0 };
      player.meta.crafts = Math.max(0, Math.floor(Number(player.meta.crafts) || 0) + 1);
      markDirty(player);
      const def = getItemDef(rewardId);
      pushChat({ kind: "system", text: `${player.name} crafted ${def ? def.name : rewardId}!`, from: { id: "system", name: "Town" } });
      pushFx({ type: "guard", x: player.x, y: player.y, byPlayerId: player.id, payload: { craft: true, rewardId } });
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
      markDirty(player);
        const newLevel = levelForXp(player.xp);
        if (newLevel > player.level) {
          const prevLevel = player.level;
          player.level = newLevel;
          player.statPoints += Math.max(0, newLevel - prevLevel);
          ensurePlayerVitals(player, { gainHpFromMaxHpIncrease: true });
          pushChat({ kind: "system", text: `${player.name} reached Level ${player.level}!`, from: { id: "system", name: "Town" } });
          markDirty(player);
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

    if (type === "party_create") {
      if (player.partyId) return;
      const partyId = createParty(player.id);
      player.partyId = partyId;
      markDirty(player);
      pushChat({ kind: "system", text: `${player.name} formed a party.`, from: { id: "system", name: "Town" } });
      return;
    }

    if (type === "party_leave") {
      if (!player.partyId) return;
      leaveParty(player.id);
      player.partyId = null;
      markDirty(player);
      pushChat({ kind: "system", text: `${player.name} left the party.`, from: { id: "system", name: "Town" } });
      return;
    }

    if (type === "party_code") {
      if (!player.partyId) {
        send(ws, { type: "party_error", error: "隊伍：請先建立或加入隊伍" });
        return;
      }
      const party = getParty(player.partyId);
      if (!party || party.leaderId !== player.id) {
        send(ws, { type: "party_error", error: "隊伍：只有隊長可以產生邀請碼" });
        return;
      }
      const joinCode = createPartyJoinCode(player.partyId);
      send(ws, { type: "party_code", joinCode });
      return;
    }

    if (type === "party_join") {
      const code = String(msg?.joinCode || "").trim().toUpperCase();
      const rec = partyJoinCodes.get(code);
      if (!rec) {
        send(ws, { type: "party_error", error: "隊伍：邀請碼無效" });
        return;
      }
      if (nowMs() > rec.expiresAt) {
        partyJoinCodes.delete(code);
        send(ws, { type: "party_error", error: "隊伍：邀請碼已過期" });
        return;
      }
      const ok = joinParty(player.id, rec.partyId);
      if (!ok) {
        send(ws, { type: "party_error", error: "隊伍：隊伍不存在" });
        return;
      }
      player.partyId = rec.partyId;
      markDirty(player);
      pushChat({ kind: "system", text: `${player.name} joined a party.`, from: { id: "system", name: "Town" } });
      return;
    }

    if (type === "party_summon") {
      if (!player.partyId) {
        send(ws, { type: "party_error", error: "隊伍：請先加入隊伍" });
        return;
      }
      const party = getParty(player.partyId);
      if (!party || party.leaderId !== player.id) {
        send(ws, { type: "party_error", error: "隊伍：只有隊長可以召喚" });
        return;
      }
      const now = nowMs();
      if (now - Number(party.lastSummonAt || 0) < 30_000) {
        send(ws, { type: "party_error", error: "隊伍：召喚冷卻中" });
        return;
      }
      const z = Math.max(0, Math.floor(Number(player.zenny) || 0));
      if (z < 10) {
        send(ws, { type: "party_error", error: "隊伍：需要 10 Zeny" });
        return;
      }
      player.zenny = z - 10;
      markDirty(player);
      party.lastSummonAt = now;

      const id = randomToken('m_elite');
      monsters.set(id, {
        id,
        kind: 'elite',
        name: 'King Poring',
        x: clamp(player.x + 18, 0, (WORLD.width - 1) * WORLD.tileSize),
        y: clamp(player.y, 0, (WORLD.height - 1) * WORLD.tileSize),
        hp: 80,
        maxHp: 80,
        alive: true,
        respawnAt: null,
        vx: 0,
        vy: 0,
        nextWanderAt: now + 60_000,
      });

      pushChat({ kind: "system", text: `An elite appeared: King Poring!`, from: { id: "system", name: "Town" } });
      pushFx({ type: "mark", x: player.x + 18, y: player.y, byPlayerId: player.id, payload: { elite: true } });
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
    // If no external bot is controlling, run a tiny built-in autopilot.
    maybeAutopilot(p);

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
        markDirty(p);
        const newLevel = levelForXp(p.xp);
        if (newLevel > p.level) {
          const prevLevel = p.level;
          p.level = newLevel;
          p.statPoints += Math.max(0, newLevel - prevLevel);
          ensurePlayerVitals(p, { gainHpFromMaxHpIncrease: true });
          pushChat({ kind: "system", text: `${p.name} reached Level ${p.level}!`, from: { id: "system", name: "Town" } });
          markDirty(p);
        }
      }
    }

    // auto pick up loot when nearby
    tryAutoPickup(p);

    // persist progress (throttled)
    persistPlayerIfNeeded(p, false);
  }

  broadcast({ type: "state", state: currentState() });
}

setInterval(() => {
  // cleanup expired join codes
  const t = nowMs();
  for (const [code, rec] of joinCodes.entries()) {
    if (t > rec.expiresAt) joinCodes.delete(code);
  }
  cleanupExpiredPartyCodes();
}, 2000);

setInterval(tick, WORLD.tickMs);

spawnInitialMonsters();

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  const prettyHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Clawtown running: http://${prettyHost}:${PORT}`);
});
