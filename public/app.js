/* global WebSocket, fetch, localStorage */

const statusEl = document.getElementById("status");
const taglineEl = document.getElementById("tagline");
const hudHelpEl = document.getElementById("hudHelp");
const slot2NameEl = document.getElementById("slot2Name");
const slot3NameEl = document.getElementById("slot3Name");
const botTitleEl = document.getElementById("botTitle");
const langZhBtn = document.getElementById("langZh");
const langEnBtn = document.getElementById("langEn");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stageEl = document.getElementById("stage");
const panelEl = document.getElementById("panel");
const drawerHandleEl = document.getElementById("drawerHandle");
const mobileMenuBtn = document.getElementById("mobileMenu");
const joystickEl = document.getElementById("joystick");
const joystickKnobEl = joystickEl ? joystickEl.querySelector(".joystick-knob") : null;
const minimapEl = document.getElementById("minimap");
const minimapCtx = minimapEl ? minimapEl.getContext("2d") : null;

// Temporary avatar sprite (can be replaced with better skins later)
const avatarSprite = new Image();
avatarSprite.src = "/assets/poring_mount_alpha.png";
let avatarSpriteReady = false;
avatarSprite.onload = () => {
  avatarSpriteReady = true;
};

// Custom avatar cache (player-uploaded). Always rendered at the same in-world size.
const avatarImgCache = new Map(); // url -> { img, ready, lastUsedAt }
function getCustomAvatarImg(url) {
  const key = String(url || "").trim();
  if (!key) return null;
  let v = avatarImgCache.get(key);
  if (!v) {
    const img = new Image();
    v = { img, ready: false, lastUsedAt: Date.now() };
    img.onload = () => { v.ready = true; };
    img.onerror = () => { v.ready = false; };
    img.src = key;
    avatarImgCache.set(key, v);

    // Basic LRU-ish cleanup.
    if (avatarImgCache.size > 120) {
      const entries = Array.from(avatarImgCache.entries()).sort((a, b) => (a[1].lastUsedAt || 0) - (b[1].lastUsedAt || 0));
      for (let i = 0; i < 40; i++) avatarImgCache.delete(entries[i][0]);
    }
  }
  v.lastUsedAt = Date.now();
  return v.ready ? v.img : null;
}

const hudNameEl = document.getElementById("hudName");
const hudJobEl = document.getElementById("hudJob");
const hudLevelEl = document.getElementById("hudLevel");
const hudModeEl = document.getElementById("hudMode");
const hudBotEl = document.getElementById("hudBot");

const nameInput = document.getElementById("name");
const avatarPreviewEl = document.getElementById("avatarPreview");
const avatarFileEl = document.getElementById("avatarFile");
const avatarUploadBtn = document.getElementById("avatarUpload");
const avatarResetBtn = document.getElementById("avatarReset");
const avatarBgToggleBtn = document.getElementById("avatarBgToggle");
const jobEl = document.getElementById("job");
const levelEl = document.getElementById("level");
const modeManualBtn = document.getElementById("modeManual");
const modeAgentBtn = document.getElementById("modeAgent");
const killsEl = document.getElementById("kills");
const craftsEl = document.getElementById("crafts");
const pickupsEl = document.getElementById("pickups");
const achievementsEl = document.getElementById("achievements");

const statPointsEl = document.getElementById("statPoints");
const hpPillEl = document.getElementById("hpPill");
const statStrValEl = document.getElementById("statStrVal");
const statAgiValEl = document.getElementById("statAgiVal");
const statVitValEl = document.getElementById("statVitVal");
const statIntValEl = document.getElementById("statIntVal");
const statDexValEl = document.getElementById("statDexVal");
const statLukValEl = document.getElementById("statLukVal");

const allocStrBtn = document.getElementById("allocStr");
const allocAgiBtn = document.getElementById("allocAgi");
const allocVitBtn = document.getElementById("allocVit");
const allocIntBtn = document.getElementById("allocInt");
const allocDexBtn = document.getElementById("allocDex");
const allocLukBtn = document.getElementById("allocLuk");

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
const chatFilterAllBtn = document.getElementById("chatFilterAll");
const chatFilterPeopleBtn = document.getElementById("chatFilterPeople");
const chatFilterSystemBtn = document.getElementById("chatFilterSystem");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

const botLogEl = document.getElementById("botLog");
const botStatusEl = document.getElementById("botStatus");

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

const langToggleEl = document.getElementById("langToggle");

const moreBtnEl = document.getElementById("moreBtn");
const moreMenuEl = document.getElementById("moreMenu");
const moreMenuItems = Array.from(document.querySelectorAll(".ui-more-item"));

const tabButtons = Array.from(document.querySelectorAll(".ui-tab"));
const tabPanels = Array.from(document.querySelectorAll(".tab"));

const badgeChatEl = document.getElementById("badgeChat");
const badgeBoardEl = document.getElementById("badgeBoard");
const badgeBoardMenuEl = document.getElementById("badgeBoardMenu");

const LANG_KEY = "clawtown.lang";
let lang = (() => {
  try {
    const v = String(localStorage.getItem(LANG_KEY) || "").trim().toLowerCase();
    return v === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
})();

const UNREAD_KEY = "clawtown.unread.v1";
let unread = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(UNREAD_KEY) || "null");
    if (v && typeof v === "object") {
      return {
        chatSeenAt: Number(v.chatSeenAt || 0) || 0,
        boardSeenAt: Number(v.boardSeenAt || 0) || 0,
        chatCount: Math.max(0, Math.floor(Number(v.chatCount || 0) || 0)),
        boardCount: Math.max(0, Math.floor(Number(v.boardCount || 0) || 0)),
      };
    }
  } catch {
    // ignore
  }
  return { chatSeenAt: 0, boardSeenAt: 0, chatCount: 0, boardCount: 0 };
})();

let activeTabKey = "character";

function persistUnread() {
  try {
    localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
  } catch {
    // ignore
  }
}

function renderBadges() {
  const show = (el, n) => {
    if (!el) return;
    const v = Math.max(0, Math.floor(Number(n || 0) || 0));
    if (v <= 0) {
      el.hidden = true;
      return;
    }
    el.textContent = v > 99 ? "99+" : String(v);
    el.hidden = false;
  };
  show(badgeChatEl, unread.chatCount);
  show(badgeBoardEl, unread.boardCount);
  show(badgeBoardMenuEl, unread.boardCount);
}

renderBadges();

const CHAT_FILTER_KEY = "clawtown.chat.filter"; // "all" | "people" | "system"
let chatFilter = (() => {
  try {
    const v = String(localStorage.getItem(CHAT_FILTER_KEY) || "").trim().toLowerCase();
    if (v === "people" || v === "system") return v;
    // Default: show people chat (avoid system spam). Users can switch to "All" anytime.
    return "people";
  } catch {
    return "people";
  }
})();

const AVATAR_BG_KEY = "clawtown.avatarBgFix"; // "on" | "off"
let avatarBgFixEnabled = (() => {
  try {
    return (localStorage.getItem(AVATAR_BG_KEY) || "on") !== "off";
  } catch {
    return true;
  }
})();

const CT_TEST = Boolean(globalThis.__CT_ENV__ && globalThis.__CT_ENV__.ctTest);
let coach = null;
let hoverTips = null;

const I18N = {
  zh: {
    tagline: "一個人類 + CloudBot 的小鎮 MMO",
    "hud.help": "WASD/方向鍵移動・Enter 聊天・滑鼠點地面設定目標",
    "action.slot1": "技能1",
    "action.slot2": "揮手",
    "action.slot3": "標記",
    "action.slot4": "職業技",
    "tabs.character": "角色",
    "tabs.inventory": "背包",
    "tabs.party": "隊伍",
    "tabs.hat": "分類帽",
    "tabs.board": "公告板",
    "tabs.chat": "聊天",
    "tabs.bot": "Bot 想法",
    "tabs.link": "連結 Bot",
    "tabs.more": "更多",
    "character.title": "我的角色",
    "character.avatarLabel": "頭像",
    "character.avatarUpload": "上傳頭像",
    "character.avatarReset": "恢復預設",
    "character.avatarBgToggle": "背景修正",
    "character.avatarHelp": "會自動裁切成方形並縮放；地圖上大家大小一致。",
    "character.nameLabel": "暱稱",
    "character.namePlaceholder": "輸入暱稱",
    "character.statsTitle": "能力值",
    "character.statsHelp": "v1：STR→ATK、AGI→ASPD、VIT→HP/DEF、LUK→CRIT。先做簡單有感，之後再細化職業流派。",
    "character.achievementsTitle": "成就",
    "character.modeLabel": "模式",
    "character.modeManual": "手動",
    "character.modeAgent": "H-Mode",
    "character.modeHelp": "手動：你控制移動。H-Mode：你的 CloudBot 接手行動。",
    "character.intentLabel": "公開意圖（大家看得到）",
    "character.intentPlaceholder": "例如：先打史萊姆，再去公告板接任務",
    "character.intentSave": "設定意圖",
    "character.cast": "施放/攻擊",
    "character.skillsTitle": "技能設定",
    "character.skill1NameLabel": "技能 1 名稱",
    "character.skill1NamePlaceholder": "例如：聖光一閃",
    "character.skill1EffectLabel": "技能 1 視覺效果",
    "character.skill1EffectHelp": "v1：施放/攻擊時會用這個效果打附近怪。",
    "character.saveSkill1": "儲存技能 1",
    "character.skill4Title": "技能 4（職業技能）",
    "character.skill4NameLabel": "技能 4 名稱",
    "character.skill4NamePlaceholder": "例如：火球雨",
    "character.skill4EffectLabel": "技能 4 類型 / 效果",
    "character.skill4Help": "按 4 施放。點地技能會進入瞄準狀態，點地面後落點施放。",
    "character.saveSkill4": "儲存技能 4",
    "common.reset": "重置",
    "common.copy": "複製",
    "skill.effect.spark": "火花（預設）",
    "skill.effect.blink": "瞬步",
    "skill.effect.mark": "標記",
    "skill.effect.echo": "回音",
    "skill.effect.guard": "護盾",
    "skill.job.fireball": "法師：火球雨（點地 AoE）",
    "skill.job.hail": "法師：冰雹（點地 AoE）",
    "skill.job.arrow": "弓手：遠程射擊（朝向射出）",
    "skill.job.cleave": "騎士：橫掃（近距離多目標）",
    "skill.job.flurry": "刺客：疾刺（連擊 + 爆擊）",
    "skill.job.signature": "通用：普通攻擊",
    "inventory.title": "背包",
    "inventory.craftTitle": "合成",
    "inventory.craftHelp": "3x Poring Jelly → 隨機裝備（v1）。",
    "inventory.craftOnce": "合成一次",
    "inventory.craftNeed3": "需要 3 Jelly",
    "inventory.equipTitle": "裝備",
    "inventory.weapon": "武器",
    "inventory.armor": "防具",
    "inventory.accessory": "飾品",
    "inventory.itemsTitle": "物品",
    "inventory.itemsHelp": "打倒怪物會掉落物品，靠近會自動撿起。",
    "party.title": "隊伍",
    "party.help": "手動模式與 H-Mode 都可以在同一隊。隊伍一起打更大的怪，掉更好的寶物。",
    "party.create": "建立隊伍",
    "party.leave": "離開",
    "party.inviteLabel": "邀請碼（隊長產生）",
    "party.invitePlaceholder": "點右邊產生",
    "party.generate": "產生",
    "party.inviteHelp": "把邀請碼給朋友，在他那邊貼上後按加入。",
    "party.joinLabel": "加入隊伍",
    "party.joinPlaceholder": "輸入 6 碼邀請碼",
    "party.join": "加入",
    "party.membersTitle": "隊伍成員",
    "party.challengeTitle": "隊伍挑戰",
    "party.challengeHelp": "隊長可召喚精英史萊姆（需要 10 Zeny，冷卻 30 秒）。",
    "party.summon": "召喚精英",
    "hat.title": "分類帽",
    "hat.cap": "THE HAT",
    "hat.sub": "說點謎語，但其實很溫柔。",
    "hat.freePlaceholder": "選填：一句話描述你",
    "hat.continue": "繼續",
    "hat.skip": "略過",
    "hat.restart": "重來",
    "hat.check": "檢查是否已精煉",
    "hat.link": "連結 Bot 讓我更懂你",
    "board.title": "公告板",
    "board.placeholder": "寫下傳聞、委託、招募...",
    "board.send": "張貼",
    "chat.title": "聊天",
    "chat.filterAll": "全部",
    "chat.filterPeople": "玩家",
    "chat.filterSystem": "系統",
    "chat.placeholder": "說點什麼...",
    "chat.send": "送出",
    "bot.title": "Bot 想法",
    "bot.help": "尚未收到 Bot 指令。把「連結 Bot」的 Connect 指令或 Join Token 貼到 Moltbot / Telegram 後，這裡會顯示它的意圖與動作。",
    "link.title": "連結你的 CloudBot",
    "link.help": "流程：產生 Join Token → 貼給 Bot → Bot 自動綁定 → 你切到 H-Mode。",
    "link.makeJoinToken": "取得 Join Token",
    "link.details": "進階資訊（Join Token）",
    "link.joinTokenLabel": "Join Token（推薦）",
    "link.joinTokenHelp": "這一段包含「要打的伺服器」與「對應的 code」，Bot 才知道要連哪裡。",
    "link.sandboxJoinTokenLabel": "Docker sandbox Join Token",
    "link.sandboxJoinTokenHelp": "如果你的 Bot 跑在 Docker 裡，請用這個（透過 host.docker.internal 連回主機）。",
    "link.promptTitle": "貼給 Bot 的 Connect 指令",
    "link.promptPlaceholder": "按上面的『取得 Join Token』後，這裡會生成一段可以直接貼給 Bot 的 connect 指令。",
    "link.copyPrompt": "複製 Connect 指令",
    "link.copyPromptDocker": "複製 Connect（Docker 版）",
    "link.promptHelp": "最簡流程：取得 Join Token → 複製這段 → 貼到 Telegram/WhatsApp/Discord/Slack 的 bot。",
    "link.dockerGap": "只有本機開發才需要：Bot 跑在 Docker 時，不能用 localhost，請改用 host.docker.internal 版 token。",
    "link.skillHelp": "最穩的做法：叫 Bot 讀 https://clawtown.io/skill.md（不依賴 clawtown CLI）。",
    "link.advanced": "進階：Bot 也可以根據你的 context 來精煉分類帽結果（職業/技能敘事）。",
    "onboarding.title": "歡迎來到 Clawtown",
    "onboarding.text": "先選語言（右上）→ 用 WASD/方向鍵（或手機左下搖桿）走動 → 按 4 攻擊，先打倒第一隻史萊姆！想要全自動：去「連結 Bot」把 Join Token 貼給 Moltbot/Clawbot 解鎖 H-Mode。",
    "onboarding.start": "進入小鎮",
    "onboarding.goHat": "先連結 Bot",
    "onboarding.foot": "小技巧：本機開兩個分頁就能 demo 多人互動。",
    "status.connecting": "連線中...",
    "status.connected": "已連線",
    "status.reconnecting": "已斷線（重連中...）",
    "label.job": "職業：",
    "label.level": "等級 ",
    "label.kills": "擊殺：",
    "label.crafts": "合成：",
    "label.pickups": "拾取：",
    "label.points": "點數：",
    "label.hp": "HP：",
    "hud.job": "職業:",
    "hud.level": "等級:",
    "hud.botLinked": "Bot：已連結",
    "hud.botUnlinked": "Bot：未連結",
    "hud.modeManual": "手動",
    "hud.modeAgent": "H-Mode",

    // Hover tips (beginner-friendly, RO-ish)
    "tip.statPoints": "可分配點數。每升 1 等會 +1 點，用來強化 STR/AGI/VIT/INT/DEX/LUK。",
    "tip.hp": "生命值。降到 0 會倒下並在廣場復活。VIT 會提高最大 HP。",
    "tip.atk": "攻擊力。影響普攻/多數技能傷害。主要來自 STR + 武器/飾品。",
    "tip.def": "防禦力。降低受到的傷害。主要來自 VIT + 防具。",
    "tip.zenny": "Zeny（金幣）。打怪會掉落；部分隊伍/挑戰會消耗。",
    "tip.str": "STR：更痛（提高 ATK）。",
    "tip.agi": "AGI：更快出手（提高 ASPD）。",
    "tip.vit": "VIT：更耐打（提高 HP/DEF）。",
    "tip.int": "INT：法術成長預留（v1 仍簡化）。",
    "tip.dex": "DEX：命中/遠程手感預留（v1 仍簡化）。",
    "tip.luk": "LUK：更容易爆（提高 CRIT）。",

    // Micro tutorial ("Aha" fast path)
    "coach.lang": "先選語言（右上角）。",
    "coach.move.mobile": "拖曳左下搖桿移動。",
    "coach.move.desktop": "WASD/方向鍵移動，或點地面走路。",
    "coach.attack": "Aha：按「4 / ATK」打最近的史萊姆。",
    "coach.loot": "看到掉落了嗎？靠近會自動撿起。去「背包」看看。",
    "coach.equip": "把武器裝上，ATK 會立刻變強。",
    "coach.done": "恭喜！你打倒第一隻史萊姆。接下來：打怪 → 撿裝 → 變強。",
  },
  en: {
    tagline: "A human + CloudBot town MMO",
    "hud.help": "Move: WASD/Arrows · Chat: Enter · Set goal: click ground",
    "action.slot1": "Skill 1",
    "action.slot2": "Wave",
    "action.slot3": "Mark",
    "action.slot4": "Job",
    "tabs.character": "Character",
    "tabs.inventory": "Inventory",
    "tabs.party": "Party",
    "tabs.hat": "Hat",
    "tabs.board": "Board",
    "tabs.chat": "Chat",
    "tabs.bot": "Bot Thoughts",
    "tabs.link": "Link Bot",
    "tabs.more": "More",
    "character.title": "My Character",
    "character.avatarLabel": "Avatar",
    "character.avatarUpload": "Upload",
    "character.avatarReset": "Reset",
    "character.avatarBgToggle": "Fix background",
    "character.avatarHelp": "Auto-crops to a square and resizes. Everyone stays the same size on the map.",
    "character.nameLabel": "Name",
    "character.namePlaceholder": "Enter name",
    "character.statsTitle": "Stats",
    "character.statsHelp": "v1: STR→ATK, AGI→ASPD, VIT→HP/DEF, LUK→CRIT. Keep it simple now; we can deepen builds later.",
    "character.achievementsTitle": "Achievements",
    "character.modeLabel": "Mode",
    "character.modeManual": "Manual",
    "character.modeAgent": "H-Mode",
    "character.modeHelp": "Manual: you move. H-Mode: your CloudBot takes over.",
    "character.intentLabel": "Public intent (visible to all)",
    "character.intentPlaceholder": "e.g. Hunt slimes, then check the board",
    "character.intentSave": "Set intent",
    "character.cast": "Cast / Attack",
    "character.skillsTitle": "Skills",
    "character.skill1NameLabel": "Skill 1 name",
    "character.skill1NamePlaceholder": "e.g. Holy Slash",
    "character.skill1EffectLabel": "Skill 1 VFX",
    "character.skill1EffectHelp": "v1: Attack uses this VFX.",
    "character.saveSkill1": "Save Skill 1",
    "character.skill4Title": "Skill 4 (job skill)",
    "character.skill4NameLabel": "Skill 4 name",
    "character.skill4NamePlaceholder": "e.g. Fire Rain",
    "character.skill4EffectLabel": "Skill 4 type",
    "character.skill4Help": "Press 4 to cast. Targeted skills enter aiming mode; click ground to cast.",
    "character.saveSkill4": "Save Skill 4",
    "common.reset": "Reset",
    "common.copy": "Copy",
    "skill.effect.spark": "Spark (default)",
    "skill.effect.blink": "Blink",
    "skill.effect.mark": "Mark",
    "skill.effect.echo": "Echo",
    "skill.effect.guard": "Guard",
    "skill.job.fireball": "Mage: Fire Rain (targeted AoE)",
    "skill.job.hail": "Mage: Hail (targeted AoE)",
    "skill.job.arrow": "Archer: Arrow Shot (directional)",
    "skill.job.cleave": "Knight: Cleave (multi-hit)",
    "skill.job.flurry": "Assassin: Flurry (combo + crit)",
    "skill.job.signature": "Generic: Basic attack",
    "inventory.title": "Inventory",
    "inventory.craftTitle": "Crafting",
    "inventory.craftHelp": "3x Poring Jelly → random equipment (v1).",
    "inventory.craftOnce": "Craft once",
    "inventory.craftNeed3": "Need 3 Jelly",
    "inventory.equipTitle": "Equipment",
    "inventory.weapon": "Weapon",
    "inventory.armor": "Armor",
    "inventory.accessory": "Accessory",
    "inventory.itemsTitle": "Items",
    "inventory.itemsHelp": "Monsters drop loot; pick up automatically when nearby.",
    "party.title": "Party",
    "party.help": "Manual and H-Mode can be in the same party. Fight bigger monsters together for better loot.",
    "party.create": "Create party",
    "party.leave": "Leave",
    "party.inviteLabel": "Invite code (leader)",
    "party.invitePlaceholder": "Click Generate",
    "party.generate": "Generate",
    "party.inviteHelp": "Share the code with a friend; they paste it and press Join.",
    "party.joinLabel": "Join party",
    "party.joinPlaceholder": "Enter 6-char code",
    "party.join": "Join",
    "party.membersTitle": "Members",
    "party.challengeTitle": "Party challenge",
    "party.challengeHelp": "Leader can summon an elite slime (10 Zeny, 30s cooldown).",
    "party.summon": "Summon elite",
    "hat.title": "The Hat",
    "hat.cap": "THE HAT",
    "hat.sub": "Speaks in riddles, but is kind.",
    "hat.freePlaceholder": "Optional: one line about you",
    "hat.continue": "Continue",
    "hat.skip": "Skip",
    "hat.restart": "Restart",
    "hat.check": "Check refinement",
    "hat.link": "Link Bot to refine",
    "board.title": "Board",
    "board.placeholder": "Rumors, quests, recruiting...",
    "board.send": "Post",
    "chat.title": "Chat",
    "chat.filterAll": "All",
    "chat.filterPeople": "People",
    "chat.filterSystem": "System",
    "chat.placeholder": "Say something...",
    "chat.send": "Send",
    "bot.title": "Bot Thoughts",
    "bot.help": "No bot actions yet. Paste the Connect command or Join Token from Link Bot into Moltbot / Telegram to see intents and actions here.",
    "link.title": "Link your CloudBot",
    "link.help": "Flow: generate a Join Token → paste to your bot → bot links automatically → switch to H-Mode.",
    "link.makeJoinToken": "Get Join Token",
    "link.details": "Advanced (Join Token)",
    "link.joinTokenLabel": "Join Token (recommended)",
    "link.joinTokenHelp": "This includes the server URL and code so the bot knows where to connect.",
    "link.sandboxJoinTokenLabel": "Docker sandbox Join Token",
    "link.sandboxJoinTokenHelp": "If your bot runs in Docker, use this (connect back via host.docker.internal).",
    "link.promptTitle": "Connect command for your bot",
    "link.promptPlaceholder": "After you click Get Join Token, a ready-to-paste connect command appears here.",
    "link.copyPrompt": "Copy connect command",
    "link.copyPromptDocker": "Copy connect (Docker)",
    "link.promptHelp": "Fast path: Get Join Token → Copy this → Paste into your bot (Telegram/WhatsApp/Discord/Slack).",
    "link.dockerGap": "Local dev only: Docker bots cannot reach localhost; use the host.docker.internal token.",
    "link.skillHelp": "Best: tell your bot to read https://clawtown.io/skill.md (no CLI required).",
    "link.advanced": "Advanced: the bot can refine Hat results using your context.",
    "onboarding.title": "Welcome to Clawtown",
    "onboarding.text": "Pick a language (top-right) → Move with WASD/Arrows (or the mobile joystick) → Press 4 to defeat your first slime! Want autopilot? Go to “Link Bot”, paste the Join Token into Moltbot/Clawbot, and switch to H-Mode.",
    "onboarding.start": "Enter town",
    "onboarding.goHat": "Link Bot first",
    "onboarding.foot": "Tip: open two tabs to demo multiplayer.",
    "status.connecting": "Connecting...",
    "status.connected": "Connected",
    "status.reconnecting": "Disconnected (reconnecting...)",
    "label.job": "Job: ",
    "label.level": "Level ",
    "label.kills": "Kills: ",
    "label.crafts": "Crafts: ",
    "label.pickups": "Pickups: ",
    "label.points": "Points: ",
    "label.hp": "HP: ",
    "hud.job": "Job:",
    "hud.level": "Lv:",
    "hud.botLinked": "Bot: linked",
    "hud.botUnlinked": "Bot: not linked",
    "hud.modeManual": "Manual",
    "hud.modeAgent": "H-Mode",

    // Hover tips
    "tip.statPoints": "Spendable points. Each level gives +1 point to STR/AGI/VIT/INT/DEX/LUK.",
    "tip.hp": "Hit Points. At 0 you faint and respawn. VIT increases max HP.",
    "tip.atk": "Attack Power. Affects basic attacks and most skills. Mainly STR + weapon/accessory.",
    "tip.def": "Defense. Reduces incoming damage. Mainly VIT + armor.",
    "tip.zenny": "Zeny (gold). Dropped by monsters; some party/challenges consume it.",
    "tip.str": "STR: hit harder (ATK).",
    "tip.agi": "AGI: act faster (ASPD).",
    "tip.vit": "VIT: tankier (HP/DEF).",
    "tip.int": "INT: reserved for magic scaling (v1 is simplified).",
    "tip.dex": "DEX: reserved for hit/ranged feel (v1 is simplified).",
    "tip.luk": "LUK: crit more often (CRIT).",

    // Micro tutorial
    "coach.lang": "Pick your language (top-right).",
    "coach.move.mobile": "Drag the joystick (bottom-left) to move.",
    "coach.move.desktop": "Move with WASD/Arrows, or click the ground.",
    "coach.attack": "Aha moment: press “4 / ATK” to hit the nearest slime.",
    "coach.loot": "See drops? Walk near them to auto-pickup. Open Inventory.",
    "coach.equip": "Equip a weapon to boost ATK immediately.",
    "coach.done": "Nice! First slime down. Next: kill → loot → equip → stronger.",
  },
};

function t(key, vars) {
  const dict = (lang === 'en' ? I18N.en : I18N.zh) || {};
  const fallback = I18N.zh || {};
  let s = dict[key] || fallback[key] || String(key);
  const v = vars && typeof vars === 'object' ? vars : {};
  for (const k of Object.keys(v)) {
    s = s.replaceAll(`{${k}}`, String(v[k]));
  }
  return s;
}

function applyI18n() {
  try {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  } catch {
    // ignore
  }

  if (langZhBtn) langZhBtn.classList.toggle('is-active', lang !== 'en');
  if (langEnBtn) langEnBtn.classList.toggle('is-active', lang === 'en');

  for (const el of Array.from(document.querySelectorAll('[data-i18n]'))) {
    const k = el.getAttribute('data-i18n');
    if (!k) continue;
    el.textContent = t(k);
  }
  for (const el of Array.from(document.querySelectorAll('[data-i18n-placeholder]'))) {
    const k = el.getAttribute('data-i18n-placeholder');
    if (!k) continue;
    el.setAttribute('placeholder', t(k));
  }
  for (const el of Array.from(document.querySelectorAll('option[data-i18n]'))) {
    const k = el.getAttribute('data-i18n');
    if (!k) continue;
    el.textContent = t(k);
  }

  // Non-annotated but important.
  if (taglineEl) taglineEl.textContent = t('tagline');
  if (hudHelpEl) hudHelpEl.textContent = t('hud.help');
  if (slot2NameEl) slot2NameEl.textContent = t('action.slot2');
  if (slot3NameEl) slot3NameEl.textContent = t('action.slot3');
  if (botTitleEl) botTitleEl.textContent = t('bot.title');

  renderHeader();
  renderAchievements();
  renderParty();
  renderBotThoughts();
}

function setLang(next) {
  lang = next === 'en' ? 'en' : 'zh';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
  applyI18n();
  hoverTips?.hide?.();
}

langZhBtn?.addEventListener('click', () => setLang('zh'));
langEnBtn?.addEventListener('click', () => setLang('en'));

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
let lastGoodState = null;
let you;
let recentFx = [];
let lastMoveSentAt = 0;
const view = {
  camX: 0,
  camY: 0,
  zoom: 1,
  _initialized: false,
};

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function currentZoom() {
  if (!state || !state.world) return 1;
  // Mobile: zoom in + camera follow so the map feels "bigger" and characters readable.
  if (!isMobileLayout()) return 1;
  try {
    const isLand = Boolean(window.matchMedia && window.matchMedia("(orientation: landscape)").matches);
    return isLand ? 1.18 : 1.32;
  } catch {
    return 1.28;
  }
}

function updateCamera() {
  if (!state || !state.world) return;
  // Desktop: keep the full town visible (no camera follow).
  if (!isMobileLayout()) {
    view.zoom = 1;
    view.camX = 0;
    view.camY = 0;
    view._initialized = false;
    return;
  }
  const t = Number(state.world.tileSize);
  const worldW = Number(state.world.width) * t;
  const worldH = Number(state.world.height) * t;
  if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;

  const z = currentZoom();
  view.zoom = z;
  const vw = canvas.width / z;
  const vh = canvas.height / z;

  const cx = you ? Number(you.x) || worldW / 2 : worldW / 2;
  const cy = you ? Number(you.y) || worldH / 2 : worldH / 2;

  const maxX = Math.max(0, worldW - vw);
  const maxY = Math.max(0, worldH - vh);
  const targetX = clamp(cx - vw / 2, 0, maxX);
  const targetY = clamp(cy - vh / 2, 0, maxY);

  if (!view._initialized) {
    view.camX = targetX;
    view.camY = targetY;
    view._initialized = true;
    return;
  }

  // Smooth follow on mobile (reduces jitter from network/state updates).
  view.camX = lerp(view.camX, targetX, 0.22);
  view.camY = lerp(view.camY, targetY, 0.22);
}

function canvasToWorld(xCanvas, yCanvas) {
  const z = view.zoom || 1;
  return {
    x: (view.camX || 0) + Number(xCanvas) / z,
    y: (view.camY || 0) + Number(yCanvas) / z,
  };
}

let takeoverToastT = 0;
function flashStatus(text, ms = 1400) {
  if (!statusEl) return;
  const t0 = Date.now();
  takeoverToastT = t0;
  const prev = statusEl.textContent;
  statusEl.textContent = text;
  setTimeout(() => {
    if (takeoverToastT !== t0) return;
    // Prefer the canonical connected label after the toast.
    statusEl.textContent = t('status.connected') || prev || '';
  }, ms);
}

function ensureManualFromUserInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  if (!you) return false;
  if (you.mode === "manual") return true;
  // Takeover: user input always wins (Tesla-style).
  setMode("manual");
  try {
    you.mode = "manual";
  } catch {
    // ignore
  }
  renderHeader();
  flashStatus(lang === "en" ? "Manual (you took over)" : "已接管：手動模式");
  return true;
}
let keyState = { up: false, down: false, left: false, right: false };
let joyState = { active: false, dx: 0, dy: 0, pointerId: null, cx: 0, cy: 0, knobX: 0, knobY: 0 };

let pendingTarget = null; // { spell }
let pendingTargetUntilMs = 0;

const localLastSpeech = new Map(); // playerId -> { text, atMs }

const pulseTimers = new WeakMap();

function pulse(el) {
  if (!el) return;
  try {
    const prev = pulseTimers.get(el);
    if (prev) clearTimeout(prev);
  } catch {
    // ignore
  }
  el.classList.add("is-pressed");
  const t = setTimeout(() => {
    el.classList.remove("is-pressed");
  }, 120);
  pulseTimers.set(el, t);
}

function openTab(tabKey) {
  activeTabKey = String(tabKey || "").trim();

  for (const b of tabButtons) {
    const is = b.dataset.tab === tabKey;
    b.classList.toggle("is-active", is);
    b.setAttribute("aria-selected", is ? "true" : "false");
  }
  for (const p of tabPanels) {
    p.classList.toggle("is-active", p.dataset.tab === tabKey);
  }

  const isAdvanced = tabKey === "board" || tabKey === "party" || tabKey === "hat";
  if (moreBtnEl) {
    moreBtnEl.classList.toggle("is-active", isAdvanced);
    moreBtnEl.setAttribute("aria-expanded", "false");
  }
  if (moreMenuEl) {
    moreMenuEl.hidden = true;
  }

  if (tabKey === "hat") {
    hatStartIfNeeded();
  }

  // Mark seen when user visits the tab.
  if (tabKey === "chat") {
    unread.chatCount = 0;
    unread.chatSeenAt = Math.max(unread.chatSeenAt || 0, maxChatCreatedAt((state && state.chats) || []));
    persistUnread();
    renderBadges();
  }
  if (tabKey === "board") {
    unread.boardCount = 0;
    unread.boardSeenAt = Math.max(unread.boardSeenAt || 0, maxCreatedAt((state && state.board) || []));
    persistUnread();
    renderBadges();
  }

  coach?.noteOpenTab?.(tabKey);
}

for (const b of tabButtons) {
  b.addEventListener("click", () => openTab(b.dataset.tab));
}

function closeMoreMenu() {
  if (moreMenuEl) moreMenuEl.hidden = true;
  if (moreBtnEl) moreBtnEl.setAttribute("aria-expanded", "false");
}

function toggleMoreMenu() {
  if (!moreMenuEl || !moreBtnEl) return;
  const next = Boolean(moreMenuEl.hidden);
  moreMenuEl.hidden = !next;
  moreBtnEl.setAttribute("aria-expanded", next ? "true" : "false");
}

moreBtnEl?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleMoreMenu();
});

for (const item of moreMenuItems) {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const key = item.getAttribute("data-tab");
    closeMoreMenu();
    try {
      if (panelEl && panelEl.classList.contains("is-collapsed")) setDrawerCollapsed(false);
    } catch {
      // ignore
    }
    if (key) openTab(key);
  });
}

// Close on outside click / ESC.
document.addEventListener("click", (e) => {
  if (!moreMenuEl || moreMenuEl.hidden) return;
  const t = e.target;
  const inside = (t && t.closest && t.closest("#moreMenu")) || (t && t.closest && t.closest("#moreBtn"));
  if (!inside) closeMoreMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMoreMenu();
});

openTab("character");

applyI18n();

// Mobile drawer (bottom sheet) — keep the map large.
const MOBILE_DRAWER_KEY = "clawtown.mobileDrawer"; // "open" | "collapsed"
function isProbablyIOS() {
  try {
    const ua = String(navigator.userAgent || "");
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    // iPadOS 13+ reports as Mac; detect via touch points.
    return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  } catch {
    return false;
  }
}

function isMobileLayout() {
  try {
    const mm = window.matchMedia;
    if (!mm) return false;

    // Primary: CSS media queries (fast path).
    if (mm("(max-width: 640px)").matches) return true;
    if (mm("(max-height: 520px) and (max-width: 1024px) and (orientation: landscape)").matches) return true;

    // Fallback: Some Safari modes (e.g. "Request Desktop Website") can lie about viewport width.
    // Treat iOS touch devices as mobile based on screen size, not layout viewport.
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const coarse = mm("(pointer: coarse)").matches;
    if (!touch && !coarse) return false;

    const sw = Math.min(Number(screen?.width || 0) || 0, Number(screen?.height || 0) || 0) || 0;
    if (isProbablyIOS() && sw > 0 && sw <= 520) return true;

    // Generic touch fallback.
    const w = Math.min(window.innerWidth || 0, window.innerHeight || 0) || 0;
    return w > 0 && w <= 520;
  } catch {
    return false;
  }
}

function setDrawerCollapsed(collapsed, { persist = true } = {}) {
  if (!panelEl) return;
  panelEl.classList.toggle("is-collapsed", Boolean(collapsed));
  try {
    document.body.classList.toggle("ct-panel-open", !collapsed);
  } catch {
    // ignore
  }
  if (drawerHandleEl) {
    drawerHandleEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
  if (persist) {
    try {
      localStorage.setItem(MOBILE_DRAWER_KEY, collapsed ? "collapsed" : "open");
    } catch {
      // ignore
    }
  }
}

function initMobileDrawer() {
  if (!panelEl) return;
  if (!isMobileLayout()) return;

  let pref = "collapsed";
  try {
    pref = localStorage.getItem(MOBILE_DRAWER_KEY) || "collapsed";
  } catch {
    // ignore
  }
  setDrawerCollapsed(pref !== "open", { persist: false });

  drawerHandleEl?.addEventListener("click", () => {
    setDrawerCollapsed(!panelEl.classList.contains("is-collapsed"));
  });
  mobileMenuBtn?.addEventListener("click", () => {
    setDrawerCollapsed(!panelEl.classList.contains("is-collapsed"));
  });

  // If user taps a tab while collapsed, expand first.
  for (const b of tabButtons) {
    b.addEventListener(
      "click",
      () => {
        if (panelEl.classList.contains("is-collapsed")) setDrawerCollapsed(false);
      },
      { capture: true }
    );
  }
}

initMobileDrawer();

function setViewportVars() {
  // iOS Safari in particular benefits from using innerHeight instead of pure 100vh.
  try {
    const vh = Math.max(1, window.innerHeight * 0.01);
    document.documentElement.style.setProperty('--ct-vh', `${vh}px`);
    const headerH = Math.max(0, Number(document.querySelector("header")?.offsetHeight || 0));
    document.documentElement.style.setProperty("--ct-header-h", `${headerH}px`);
  } catch {
    // ignore
  }
}

setViewportVars();
window.addEventListener('orientationchange', () => setTimeout(() => setViewportVars(), 80));
window.addEventListener('resize', () => setTimeout(() => setViewportVars(), 80));

function nudgeSafariChrome() {
  // iOS Safari hides the URL/tab chrome only when the page scrolls.
  // Our UI is mostly fixed, so we keep a tiny scroll shim and nudge once.
  const should = (() => {
    if (isMobileLayout()) return true;
    try {
      return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse) and (hover: none) and (orientation: landscape) and (max-width: 1400px)").matches);
    } catch {
      return false;
    }
  })();
  if (!should) return;
  try {
    if (window.scrollY <= 0) {
      // A slightly larger nudge helps iPad Safari collapse the top chrome.
      window.scrollTo(0, 48);
    }
  } catch {
    // ignore
  }
}

// Best-effort: on load + on orientation changes.
setTimeout(() => nudgeSafariChrome(), 60);
window.addEventListener("orientationchange", () => setTimeout(() => nudgeSafariChrome(), 120));
window.addEventListener("resize", () => setTimeout(() => nudgeSafariChrome(), 120));

function installNoDoubleTapZoom() {
  // iOS Safari can interpret rapid taps as a zoom gesture (especially on buttons).
  // We already set viewport user-scalable=no, but we keep a small guard for older behavior.
  let lastTouchStart = 0;
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (!isMobileLayout()) return;
      const now = Date.now();
      if (now - lastTouchStart <= 320) {
        const t = e.target;
        // IMPORTANT: do NOT include #game here. PreventDefault on the canvas breaks iOS Safari scrolling,
        // which prevents the address/tab chrome from collapsing in landscape.
        const hot = t && t.closest && t.closest('.slot, #mobileMenu, .joystick');
        if (hot) {
          e.preventDefault();
        }
      }
      lastTouchStart = now;
    },
    { passive: false, capture: true }
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!isMobileLayout()) return;
      const now = Date.now();
      if (now - lastTouchEnd <= 320) {
        const t = e.target;
        const hot = t && t.closest && t.closest('.slot, #mobileMenu, .joystick');
        if (hot) e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false, capture: true }
  );
}

installNoDoubleTapZoom();

function closeDrawerOnGameplayInteraction(e) {
  if (!isMobileLayout()) return;
  nudgeSafariChrome();
  if (!panelEl || panelEl.classList.contains('is-collapsed')) return;
  const t = e && e.target;
  if (t && t.closest && t.closest('#mobileMenu')) return;
  // Any gameplay interaction should prioritize the map: close the drawer.
  setDrawerCollapsed(true);
}

stageEl?.addEventListener('pointerdown', closeDrawerOnGameplayInteraction, { capture: true });

function initJoystick() {
  if (!joystickEl || !joystickKnobEl) return;

  function maxRadiusPx() {
    // Scale the stick radius with the control size so it feels consistent across Safari/Chrome.
    const s = Math.max(0, Number(joystickEl.clientWidth || 0));
    return clamp(s * 0.28, 26, 52);
  }
  function deadZonePx() {
    const s = Math.max(0, Number(joystickEl.clientWidth || 0));
    return clamp(s * 0.07, 8, 16);
  }

  function setKnob(x, y) {
    joyState.knobX = x;
    joyState.knobY = y;
    joystickKnobEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  function setDirFromDelta(dx, dy) {
    // 8-way-ish: allow diagonal when both axes exceed threshold.
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const dead = deadZonePx();
    const ndx = ax < dead ? 0 : dx > 0 ? 1 : -1;
    const ndy = ay < dead ? 0 : dy > 0 ? 1 : -1;
    joyState.dx = ndx;
    joyState.dy = ndy;
  }

  function resetJoy() {
    joyState.active = false;
    joyState.pointerId = null;
    joyState.dx = 0;
    joyState.dy = 0;
    joystickEl.classList.remove("is-active");
    setKnob(0, 0);
  }

  function handleMove(clientX, clientY) {
    const dx0 = clientX - joyState.cx;
    const dy0 = clientY - joyState.cy;
    const maxR = maxRadiusPx();
    const d = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
    const scale = d > maxR ? maxR / d : 1;
    const kx = dx0 * scale;
    const ky = dy0 * scale;
    setKnob(kx, ky);
    setDirFromDelta(dx0, dy0);
  }

  joystickEl.addEventListener("pointerdown", (e) => {
    if (!you) return;
    if (you.mode !== "manual") {
      // Takeover on first touch.
      ensureManualFromUserInput();
    }
    if (you.mode !== "manual") return;
    // Avoid scrolling/zooming while dragging the stick.
    e.preventDefault();
    e.stopPropagation();

    const rect = joystickEl.getBoundingClientRect();
    joyState.cx = rect.left + rect.width / 2;
    joyState.cy = rect.top + rect.height / 2;
    joyState.pointerId = e.pointerId;
    joyState.active = true;
    joystickEl.classList.add("is-active");
    try {
      joystickEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    handleMove(e.clientX, e.clientY);
  });

  joystickEl.addEventListener("pointermove", (e) => {
    if (!joyState.active) return;
    if (joyState.pointerId != null && e.pointerId !== joyState.pointerId) return;
    e.preventDefault();
    handleMove(e.clientX, e.clientY);
  });

  function onUp(e) {
    if (!joyState.active) return;
    if (joyState.pointerId != null && e.pointerId !== joyState.pointerId) return;
    e.preventDefault();
    resetJoy();
  }

  joystickEl.addEventListener("pointerup", onUp);
  joystickEl.addEventListener("pointercancel", onUp);
  joystickEl.addEventListener("lostpointercapture", () => resetJoy());

  // Safety: if focus is lost, stop moving.
  window.addEventListener("blur", () => resetJoy());
}

initJoystick();

function initHoverTooltips() {
  const tooltip = document.createElement('div');
  tooltip.id = 'ctTooltip';
  tooltip.className = 'ct-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltip);

  let activeEl = null;
  let lastX = 0;
  let lastY = 0;

  function hide() {
    activeEl = null;
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function position(x, y) {
    const pad = 12;
    const offsetX = 14;
    const offsetY = 14;
    const rect = tooltip.getBoundingClientRect();

    let left = x + offsetX;
    let top = y + offsetY;
    if (left + rect.width + pad > window.innerWidth) left = x - rect.width - offsetX;
    if (top + rect.height + pad > window.innerHeight) top = y - rect.height - offsetY;

    left = Math.max(pad, Math.min(window.innerWidth - rect.width - pad, left));
    top = Math.max(pad, Math.min(window.innerHeight - rect.height - pad, top));

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showFor(el) {
    const k = String(el.getAttribute('data-tip') || '').trim();
    if (!k) return hide();
    const text = t(k);
    if (!text) return hide();
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
    // Need a tick for layout so getBoundingClientRect is correct.
    requestAnimationFrame(() => position(lastX, lastY));
  }

  document.addEventListener('pointermove', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    if (activeEl) position(lastX, lastY);
  });

  document.addEventListener('pointerover', (e) => {
    const el = e.target && e.target.closest && e.target.closest('[data-tip]');
    if (!el) return;
    if (activeEl === el) return;
    activeEl = el;
    showFor(el);
  });

  document.addEventListener('pointerout', (e) => {
    if (!activeEl) return;
    const related = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]');
    if (related === activeEl) return;
    hide();
  });

  window.addEventListener('blur', hide);
  window.addEventListener('scroll', hide, { passive: true });

  return { hide };
}

function createCoach() {
  // Coach is disabled in CT_TEST by default to avoid flakiness in screenshots/tests.
  // Tests can explicitly enable it via `/?coach=1`.
  const coachEnabledInTest = (() => {
    try {
      return new URLSearchParams(location.search).get('coach') === '1';
    } catch {
      return false;
    }
  })();
  if (CT_TEST && !coachEnabledInTest) {
    return { onHello: () => {}, onState: () => {}, noteCast: () => {}, noteOpenTab: () => {} };
  }

  const STORAGE = `clawtown.coach.v2.${playerId}`;
  const st = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (v && typeof v === 'object') return v;
    } catch {
      // ignore
    }
    return {
      disabled: false,
      step: 'lang', // lang -> move -> attack -> done (then later steps can expand)
      startX: null,
      startY: null,
      startPickups: 0,
      startKills: 0,
      startZenny: 0,
      lastSeenFxAt: 0,
      celebrated: false,
      doneShownAt: 0,
    };
  })();

  const bubble = document.createElement('div');
  bubble.className = 'ct-coach-bubble';
  bubble.style.display = 'none';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  bubble.title = lang === 'en' ? 'Click to dismiss' : '點一下可關閉';
  document.body.appendChild(bubble);

  let highlighted = null;

  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(st));
    } catch {
      // ignore
    }
  }

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.classList.remove('ct-coach-highlight');
    highlighted = null;
  }

  function show(targetEl, text) {
    if (!targetEl || !text) return;
    if (highlighted !== targetEl) {
      clearHighlight();
      highlighted = targetEl;
      highlighted.classList.add('ct-coach-highlight');
    }

    bubble.textContent = text;
    bubble.style.display = 'block';

    const r = targetEl.getBoundingClientRect();
    const pad = 12;
    const w = 320;
    const left = Math.max(pad, Math.min(window.innerWidth - w - pad, r.left));
    const top = Math.min(window.innerHeight - pad - 48, r.bottom + 10);
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;
  }

  function hide() {
    bubble.style.display = 'none';
    clearHighlight();
  }

  function canShow() {
    if (st.disabled) return false;
    if (!onboardingEl) return true;
    // Only show after the onboarding modal is dismissed.
    return onboardingEl.getAttribute('aria-hidden') === 'true';
  }

  function setStep(next) {
    if (st.step === next) return;
    st.step = next;
    save();
  }

  bubble.addEventListener('click', () => {
    st.disabled = true;
    save();
    hide();
  });

  function onHello(p) {
    if (!p) return;
    if (st.startX == null) st.startX = Number(p.x) || 0;
    if (st.startY == null) st.startY = Number(p.y) || 0;
    st.startPickups = Number(p.meta?.pickups || 0) || 0;
    st.startKills = Number(p.meta?.kills || 0) || 0;
    st.startZenny = Number(p.zenny || 0) || 0;
    // If language has been picked before, skip the lang step.
    try {
      const hasLangPref = Boolean(String(localStorage.getItem(LANG_KEY) || '').trim());
      if (hasLangPref && st.step === 'lang') st.step = 'move';
    } catch {
      // ignore
    }
    save();
  }

  // Keep API for future expansion (loot/equip steps), but v2 focuses on first Aha.
  function noteCast() {}
  function noteOpenTab(_tabKey) {}

  function celebrate() {
    if (st.celebrated) return;
    st.celebrated = true;
    save();

    const colors = ['#ff9c45', '#2b6cb0', '#0f766e', '#b8871b', '#f472b6', '#60a5fa'];
    function burst(intensity) {
      const wrap = document.createElement('div');
      wrap.className = 'ct-confetti';
      const base = Math.max(22, Math.min(44, Math.floor(window.innerWidth / 20)));
      const n = Math.max(10, Math.floor(base * Math.max(0.25, Math.min(1.0, intensity))));
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'ct-confetti-piece';
        const left = Math.random() * 100;
        const delay = Math.random() * 120;
        const dur = 820 + Math.random() * 520;
        const sz = 7 + Math.random() * 8;
        p.style.left = `${left}%`;
        p.style.background = colors[i % colors.length];
        p.style.width = `${Math.round(sz)}px`;
        p.style.height = `${Math.round(sz * 1.4)}px`;
        p.style.animationDelay = `${Math.round(delay)}ms`;
        p.style.animationDuration = `${Math.round(dur)}ms`;
        wrap.appendChild(p);
      }
      document.body.appendChild(wrap);
      setTimeout(() => {
        try {
          wrap.remove();
        } catch {
          // ignore
        }
      }, 1600);
    }

    // “撒花三次” but keep it short and not fatiguing: one main burst + 2 tiny echoes.
    burst(1.0);
    setTimeout(() => burst(0.45), 220);
    setTimeout(() => burst(0.28), 440);
  }

  function showToast(text) {
    if (!text) return;
    clearHighlight();
    bubble.textContent = text;
    bubble.style.display = 'block';
    bubble.style.left = '50%';
    bubble.style.transform = 'translateX(-50%)';
    const top = isMobileLayout() ? 76 : 86;
    bubble.style.top = `${top}px`;
  }

  function onState(p, _state, fx) {
    if (!canShow()) return hide();
    if (!p) return hide();

    const px = Number(p.x) || 0;
    const py = Number(p.y) || 0;

    // Observe "cast happened" via VFX timestamps (fallback if user never clicks slot 1 element directly).
    let castSeen = false;
    const now = Date.now();
    for (const f of Array.isArray(fx) ? fx : []) {
      if (!f || f.byPlayerId !== playerId) continue;
      const at = Date.parse(String(f.createdAt || ''));
      if (!Number.isFinite(at)) continue;
      if (at <= (st.lastSeenFxAt || 0)) continue;
      if (['spark', 'blink', 'mark', 'echo', 'guard', 'arrow', 'cleave', 'flurry', 'fireball', 'hail', 'crit'].includes(String(f.type || ''))) {
        castSeen = true;
        st.lastSeenFxAt = Math.max(st.lastSeenFxAt || 0, at);
      }
    }
    if (castSeen) save();

    // Step transitions
    if (st.step === 'lang') {
      // Progress once user explicitly chose a language (we only set localStorage on click).
      try {
        const hasLangPref = Boolean(String(localStorage.getItem(LANG_KEY) || '').trim());
        if (hasLangPref) setStep('move');
      } catch {
        // ignore
      }
    }

    if (st.step === 'move') {
      const dx = px - (Number(st.startX) || 0);
      const dy = py - (Number(st.startY) || 0);
      if (Math.sqrt(dx * dx + dy * dy) >= 18) {
        setStep('attack');
      }
    }

    if (st.step === 'attack') {
      const kills = Number(p.meta?.kills || 0) || 0;
      if (kills > (Number(st.startKills) || 0)) {
        celebrate();
        setStep('done');
      }
    }

    // Render current step
    if (st.step === 'lang') {
      show(langToggleEl || statusEl || canvas, t('coach.lang'));
      return;
    }
    if (st.step === 'move') {
      const key = isMobileLayout() ? 'coach.move.mobile' : 'coach.move.desktop';
      show((isMobileLayout() ? (joystickEl || canvas) : canvas), t(key));
      return;
    }
    if (st.step === 'attack') {
      show(slot4 || slot1 || canvas, t('coach.attack'));
      return;
    }

    if (st.step === 'done') {
      // Show ONCE (no flashing highlight). Then stop the coach.
      if (!st.doneShownAt) {
        st.doneShownAt = Date.now();
        save();
        showToast(t('coach.done'));
        setTimeout(() => {
          if (!st.disabled) {
            hide();
            setStep('end');
          }
        }, 2600);
      } else {
        // Keep it visible while the timeout is pending.
        showToast(t('coach.done'));
      }
      return;
    }

    if (st.step === 'end') {
      hide();
      return;
    }

    hide();
  }

  return { onHello, onState, noteCast, noteOpenTab };
}

hoverTips = initHoverTooltips();
coach = createCoach();

// Test-only hooks (Playwright runs with CT_TEST=1).
if (CT_TEST) {
  window.__ctBuildConnectBlock = (opts) => buildConnectBlock(opts || {});
  window.__ctTest = window.__ctTest || {};
  window.__ctTest.addFx = (fx) => {
    try {
      if (!fx || typeof fx !== 'object') return;
      recentFx.unshift(fx);
    } catch {
      // ignore
    }
  };
  window.__ctTest.drawOnce = () => {
    try {
      draw();
    } catch {
      // surface as a page error in tests by rethrowing
      throw new Error('drawOnce failed');
    }
  };
}

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
    refreshAvatarPreview();
  }
}

function currentAvatarUrlForPlayer(p) {
  if (!p) return "/assets/avatar_default.png";
  const v = Number(p.avatarVersion || 0) || 0;
  if (v > 0) return `/api/avatars/${encodeURIComponent(p.id)}.png?v=${encodeURIComponent(String(v))}`;
  return "/assets/avatar_default.png";
}

async function refreshAvatarPreview() {
  if (!avatarPreviewEl) return;
  try {
    avatarPreviewEl.src = currentAvatarUrlForPlayer(you || { id: playerId, avatarVersion: 0 });
  } catch {
    // ignore
  }
}

function refreshAvatarBgToggle() {
  if (!avatarBgToggleBtn) return;
  avatarBgToggleBtn.classList.toggle("is-active", Boolean(avatarBgFixEnabled));
  avatarBgToggleBtn.setAttribute("aria-pressed", avatarBgFixEnabled ? "true" : "false");
}

refreshAvatarBgToggle();
avatarBgToggleBtn?.addEventListener("click", () => {
  avatarBgFixEnabled = !avatarBgFixEnabled;
  try {
    localStorage.setItem(AVATAR_BG_KEY, avatarBgFixEnabled ? "on" : "off");
  } catch {
    // ignore
  }
  refreshAvatarBgToggle();
  statusEl.textContent = avatarBgFixEnabled
    ? (lang === "en" ? "Background fix enabled." : "已開啟背景修正。")
    : (lang === "en" ? "Background fix disabled." : "已關閉背景修正。");
});

async function fileToSquarePngDataUrl(file, size, { removeBg = false } = {}) {
  const s = Math.max(32, Math.min(192, Math.floor(Number(size) || 64)));
  const blob = file instanceof Blob ? file : null;
  if (!blob) throw new Error("invalid file");

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("image decode failed"));
      im.src = url;
    });

    const w = Math.max(1, img.naturalWidth || img.width || 1);
    const h = Math.max(1, img.naturalHeight || img.height || 1);
    const m = Math.min(w, h);
    const sx = Math.floor((w - m) / 2);
    const sy = Math.floor((h - m) / 2);

    // Process at a higher resolution first; downscaling too early will blend checkerboard backgrounds
    // into many colors and make background removal less reliable.
    const ss = Math.max(160, Math.min(512, s * 6));
    const scratch = document.createElement("canvas");
    scratch.width = ss;
    scratch.height = ss;
    const sg = scratch.getContext("2d", { alpha: true });
    sg.clearRect(0, 0, ss, ss);
    sg.imageSmoothingEnabled = false;
    sg.drawImage(img, sx, sy, m, m, 0, 0, ss, ss);

    function tryRemoveBgEdges({ allowAuto = false } = {}) {
      const imgData = sg.getImageData(0, 0, ss, ss);
      const data = imgData.data;
      const idx = (x, y) => (y * ss + x) * 4;
      const corners = [
        { x: 0, y: 0 },
        { x: ss - 1, y: 0 },
        { x: 0, y: ss - 1 },
        { x: ss - 1, y: ss - 1 },
      ].map((p) => {
        const i = idx(p.x, p.y);
        return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      });

      // If the image already has transparency near the edges, don't touch it.
      if (corners.some((c) => c.a < 10)) return false;

      // Auto mode should be conservative: we only try to remove backgrounds that look like
      // "checkerboard" / white exports (common when users screenshot a transparent PNG preview).
      if (allowAuto) {
        const bright = (c) => (c.r + c.g + c.b) / 3;
        const bs = corners.map((c) => bright(c));
        const minB = Math.min(...bs);
        const maxB = Math.max(...bs);
        const allBright = minB >= 205;
        const looksLikeChecker = allBright && maxB - minB >= 10;
        const looksLikeWhite = allBright && maxB >= 235;
        if (!looksLikeChecker && !looksLikeWhite) return false;
      }

      const tol = 22; // RGB manhattan distance for clustering
      const clusters = [];
      function dist(a, b) {
        return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      }
      function addCluster(c) {
        for (const k of clusters) {
          if (dist(k, c) <= tol) {
            k.count += 1;
            return;
          }
        }
        if (clusters.length < 8) clusters.push({ r: c.r, g: c.g, b: c.b, count: 1 });
      }

      // Always include corner colors — many “transparent” images are actually checkerboard pixels,
      // and some avatars touch the border ring (so border sampling alone may miss background colors).
      for (const c of corners) {
        if (c.a > 0) addCluster({ r: c.r, g: c.g, b: c.b });
      }

      // Sample a thin border ring.
      const step = Math.max(1, Math.floor(ss / 64));
      for (let x = 0; x < ss; x += step) {
        for (const y of [0, 1, ss - 2, ss - 1]) {
          const i = idx(x, y);
          if (data[i + 3] > 0) addCluster({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
      for (let y = 0; y < ss; y += step) {
        for (const x of [0, 1, ss - 2, ss - 1]) {
          const i = idx(x, y);
          if (data[i + 3] > 0) addCluster({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }

      if (clusters.length === 0) return false;
      clusters.sort((a, b) => b.count - a.count);
      const bg = clusters.slice(0, 6); // support checkerboard + mild compression artifacts

      // If this looks like a “checkerboard”/white background, be more forgiving.
      const brightness = (c) => (c.r + c.g + c.b) / 3;
      const brightBg = bg.filter((c) => brightness(c) >= 205);
      const matchTol = brightBg.length >= 2 ? 46 : bg.length > 1 ? 32 : 22;
      function matchesBg(r, g, b) {
        for (const k of bg) {
          const d = Math.abs(r - k.r) + Math.abs(g - k.g) + Math.abs(b - k.b);
          if (d <= matchTol) return true;
        }
        return false;
      }

      const visited = new Uint8Array(ss * ss);
      const qx = new Int32Array(ss * ss);
      const qy = new Int32Array(ss * ss);
      let qh = 0;
      let qt = 0;
      function push(x, y) {
        const p = y * ss + x;
        if (visited[p]) return;
        visited[p] = 1;
        qx[qt] = x;
        qy[qt] = y;
        qt++;
      }

      for (let x = 0; x < ss; x++) {
        push(x, 0);
        push(x, ss - 1);
      }
      for (let y = 0; y < ss; y++) {
        push(0, y);
        push(ss - 1, y);
      }

      let removed = 0;
      while (qh < qt) {
        const x = qx[qh];
        const y = qy[qh];
        qh++;
        const i = idx(x, y);
        const a = data[i + 3];
        if (a > 0 && matchesBg(data[i], data[i + 1], data[i + 2])) {
          data[i + 3] = 0;
          removed++;
          if (x > 0) push(x - 1, y);
          if (x < ss - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1);
          if (y < ss - 1) push(x, y + 1);
        }
      }

      if (removed < Math.max(64, Math.floor(ss * ss * 0.02))) return false;
      sg.putImageData(imgData, 0, 0);
      return true;
    }

    // Background removal:
    // - If the user explicitly enables "Fix background", always attempt it.
    // - Otherwise, auto-attempt only for very bright checker/white backgrounds (safe default).
    if (removeBg) tryRemoveBgEdges();
    else tryRemoveBgEdges({ allowAuto: true });

    // Content-aware crop: compute bbox of non-transparent pixels, then pad it so avatars feel consistent on map.
    const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let bx = 0;
    let by = 0;
    let bw = ss;
    let bh = ss;
    try {
      const imgData = sg.getImageData(0, 0, ss, ss);
      const data = imgData.data;
      let minX = ss, minY = ss, maxX = -1, maxY = -1;
      for (let y = 0; y < ss; y++) {
        for (let x = 0; x < ss; x++) {
          const a = data[(y * ss + x) * 4 + 3];
          if (a > 10) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0 && maxY >= 0) {
        // More padding keeps avatars visually consistent (big-head pixel art won't dominate the map).
        const pad = Math.max(16, Math.floor(Math.max(maxX - minX, maxY - minY) * 0.28));
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(ss - 1, maxX + pad);
        maxY = Math.min(ss - 1, maxY + pad);
        // force square crop
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        const side = Math.max(cw, ch);
        const cx = Math.floor((minX + maxX) / 2);
        const cy = Math.floor((minY + maxY) / 2);
        bx = clampN(cx - Math.floor(side / 2), 0, ss - side);
        by = clampN(cy - Math.floor(side / 2), 0, ss - side);
        bw = side;
        bh = side;
      }
    } catch {
      // ignore
    }

    const out = document.createElement("canvas");
    out.width = s;
    out.height = s;
    const g = out.getContext("2d", { alpha: true });
    g.clearRect(0, 0, s, s);
    g.imageSmoothingEnabled = false;
    g.drawImage(scratch, bx, by, bw, bh, 0, 0, s, s);
    return out.toDataURL("image/png");
  } finally {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

async function uploadAvatarDataUrl(pngDataUrl) {
  const res = await fetch("/api/players/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, pngDataUrl }),
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error || "upload failed");
  if (you) you.avatarVersion = Number(data.avatarVersion || you.avatarVersion || 0) || 0;
  refreshAvatarPreview();
}

async function resetAvatar() {
  const res = await fetch("/api/players/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, reset: true }),
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error || "reset failed");
  if (you) you.avatarVersion = 0;
  refreshAvatarPreview();
}

avatarUploadBtn?.addEventListener("click", () => avatarFileEl?.click());
avatarFileEl?.addEventListener("change", async () => {
  try {
    const f = avatarFileEl.files && avatarFileEl.files[0];
    if (!f) return;
    // Optimistic preview: show cropped version immediately.
    const dataUrl = await fileToSquarePngDataUrl(f, 64, { removeBg: Boolean(avatarBgFixEnabled) });
    if (avatarPreviewEl) avatarPreviewEl.src = dataUrl;
    await uploadAvatarDataUrl(dataUrl);
    statusEl.textContent = lang === "en" ? "Avatar updated." : "頭像已更新。";
  } catch {
    statusEl.textContent = lang === "en" ? "Avatar upload failed." : "頭像上傳失敗。";
    refreshAvatarPreview();
  } finally {
    try {
      avatarFileEl.value = "";
    } catch {
      // ignore
    }
  }
});

avatarResetBtn?.addEventListener("click", async () => {
  try {
    await resetAvatar();
    statusEl.textContent = lang === "en" ? "Avatar reset." : "頭像已恢復預設。";
  } catch {
    statusEl.textContent = lang === "en" ? "Reset failed." : "恢復失敗。";
  }
});

function setMode(mode) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "set_mode", mode }));
}

function allocStat(stat) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "alloc_stat", stat, n: 1 }));
}

function jobSkillFor(job) {
  // Prefer the user-configured Skill 4 on the player.
  const cfg = you && you.jobSkill;
  const spell = String((cfg && cfg.spell) || "").trim() || "";
  const name = String((cfg && cfg.name) || "").trim() || "";

  if (spell) {
    const needsTarget = spell === "fireball" || spell === "hail";
    return { spell, name: name || (lang === 'en' ? 'Job Skill' : '職業技'), needsTarget };
  }

  const j = String(job || "").toLowerCase();
  if (j === "mage") return { spell: "fireball", name: lang === 'en' ? 'Fire Rain' : '火球雨', needsTarget: true };
  if (j === "archer") return { spell: "arrow", name: lang === 'en' ? 'Arrow Shot' : '遠程射擊', needsTarget: false };
  if (j === "knight") return { spell: "cleave", name: lang === 'en' ? 'Cleave' : '橫掃', needsTarget: false };
  if (j === "assassin") return { spell: "flurry", name: lang === 'en' ? 'Flurry' : '疾刺', needsTarget: false };
  if (j === "bard") return { spell: "signature", name: lang === 'en' ? 'Echo Bolt' : '回音彈', needsTarget: false };
  return { spell: "signature", name: lang === 'en' ? 'Practice Slash' : '練習斬', needsTarget: false };
}

function jobName(job) {
  const j = String(job || '').toLowerCase();
  if (lang === 'en') {
    if (j === 'novice') return 'Novice';
    if (j === 'knight') return 'Knight';
    if (j === 'mage') return 'Mage';
    if (j === 'archer') return 'Archer';
    if (j === 'assassin') return 'Assassin';
    if (j === 'bard') return 'Bard';
    return job ? String(job) : 'Unknown';
  }
  if (j === 'novice') return '初心者';
  if (j === 'knight') return '騎士';
  if (j === 'mage') return '法師';
  if (j === 'archer') return '弓手';
  if (j === 'assassin') return '刺客';
  if (j === 'bard') return '詩人';
  return job ? String(job) : '未知';
}

function castSpell(spell, x, y) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  coach?.noteCast?.();
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
  coach?.noteCast?.();
  ws.send(JSON.stringify({ type: "cast" }));
});

saveSkill1Btn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const name = String(skill1NameEl?.value || "").trim().slice(0, 48);
  const effect = String(skill1EffectEl?.value || "spark").trim();
  ws.send(JSON.stringify({ type: "set_signature", name, effect }));
  if (slot1Name) slot1Name.textContent = name || t('action.slot1');
});

resetSkill1Btn?.addEventListener("click", () => {
  if (!you) return;
  if (skill1NameEl) skill1NameEl.value = you.signatureSpell?.name || "";
  if (skill1EffectEl) skill1EffectEl.value = you.signatureSpell?.effect || "spark";
});

saveSkill4Btn?.addEventListener("click", () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const name = String(skill4NameEl?.value || "").trim().slice(0, 48);
  const spell = String(skill4SpellEl?.value || "signature").trim();
  ws.send(JSON.stringify({ type: "set_job_skill", name, spell }));
  // Optimistic UI update; server state will reconcile on next tick.
  if (you) {
    you.jobSkill = { name, spell };
    renderHeader();
  }
});

resetSkill4Btn?.addEventListener("click", () => {
  if (!you) return;
  if (skill4NameEl) skill4NameEl.value = you.jobSkill?.name || "";
  if (skill4SpellEl) skill4SpellEl.value = you.jobSkill?.spell || "signature";
});

slot1?.addEventListener("click", () => {
  pulse(slot1);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  coach?.noteCast?.();
  ws.send(JSON.stringify({ type: "cast" }));
});

slot2?.addEventListener("click", () => {
  pulse(slot2);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "emote", emote: "wave" }));
});

slot3?.addEventListener("click", () => {
  pulse(slot3);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "ping" }));
});

slot4?.addEventListener("click", () => {
  pulse(slot4);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!you) return;
  const sk = jobSkillFor(you.job);
  if (sk.needsTarget) {
    pendingTarget = { spell: sk.spell };
    pendingTargetUntilMs = Date.now() + 6000;
    statusEl.textContent = lang === 'en'
      ? `Click ground to cast: ${sk.name} (Esc to cancel)`
      : `點地面施放：${sk.name}（Esc 取消）`;
    return;
  }
  castSpell(sk.spell);
});

allocStrBtn?.addEventListener("click", () => allocStat("str"));
allocAgiBtn?.addEventListener("click", () => allocStat("agi"));
allocVitBtn?.addEventListener("click", () => allocStat("vit"));
allocIntBtn?.addEventListener("click", () => allocStat("int"));
allocDexBtn?.addEventListener("click", () => allocStat("dex"));
allocLukBtn?.addEventListener("click", () => allocStat("luk"));

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
      statusEl.textContent = ws && ws.readyState === WebSocket.OPEN ? t('status.connected') : t('status.connecting');
    }
  }
});

async function refreshHat() {
  const res = await fetch(`/api/hat/result?playerId=${encodeURIComponent(playerId)}`);
  const data = await res.json();
  if (!data?.ok) return;
  const r = data.result;
  if (!r) {
    hatResultEl.textContent = lang === 'en' ? 'Answer the questions to reveal your path.' : '回答問題來揭示你的道路。';
    return;
  }
  const title = data.source === "bot" ? (lang === 'en' ? 'Refined by CloudBot' : 'CloudBot 精煉') : (lang === 'en' ? 'The Hat' : '分類帽');
  const reasons = Array.isArray(r.reasons) ? r.reasons : [];
  const sig = r.signature || {};
  hatResultEl.innerHTML = lang === 'en'
    ? `
      <div><b>${title}</b>: you lean toward <b>${escapeHtml(r.job)}</b>.</div>
      <div style="margin-top:6px;color:rgba(19,27,42,0.72)">${reasons.map((x) => `- ${escapeHtml(x)}`).join("<br/>")}</div>
      <div style="margin-top:8px"><span style="color:rgba(19,27,42,0.68)">Signature:</span> <b>${escapeHtml(sig.name || "")}</b></div>
      <div style="margin-top:4px;color:rgba(19,27,42,0.68)">${escapeHtml(sig.tagline || "")}</div>
    `
    : `
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
  if (botPromptEl) {
    botPromptEl.value = buildConnectBlock({
      joinToken: joinTokenEl?.value || "",
      sandboxJoinToken: sandboxJoinTokenEl?.value || "",
    });
  }

  // Hide sandbox token section when not applicable (production usually doesn't need it).
  try {
    const sandboxRow = document.getElementById('sandboxJoinTokenRow');
    if (sandboxRow) sandboxRow.hidden = !String(data.sandboxJoinToken || '').trim();
  } catch {
    // ignore
  }

  // Only show Docker-specific copy/help when we are in local-dev mode.
  try {
    const parsed = parseJoinToken(data.joinToken || "");
    const isLocal = parsed && (parsed.baseUrl.includes("localhost") || parsed.baseUrl.includes("127.0.0.1") || parsed.baseUrl.includes("0.0.0.0"));
    // The docker gap helper is only meaningful for localhost dev.
    const dockerHelp = document.querySelector('[data-i18n="link.dockerGap"]');
    if (dockerHelp) dockerHelp.toggleAttribute('hidden', !isLocal);
  } catch {
    // ignore
  }

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

function buildConnectBlock({ joinToken, sandboxJoinToken }) {
  const a = parseJoinToken(joinToken);
  const b = parseJoinToken(sandboxJoinToken);
  if (!a && !b) return lang === 'en' ? '(click Get Join Token first)' : '（請先按『取得 Join Token』）';

  const isLocal =
    Boolean(a && (a.baseUrl.includes('localhost') || a.baseUrl.includes('127.0.0.1') || a.baseUrl.includes('0.0.0.0'))) ||
    Boolean(b && (b.baseUrl.includes('localhost') || b.baseUrl.includes('127.0.0.1') || b.baseUrl.includes('0.0.0.0')));

  const primary = a || b;
  const lines = [];
  // Always output English so it works reliably for most third-party agents.
  lines.push('Read https://clawtown.io/skill.md and follow the instructions to connect to Clawtown.');
  lines.push(`Join token: ${primary.raw}`);
  lines.push('After linking: switch to H-Mode (mode="agent") and start acting (world → cast/goal loop).');
  if (isLocal && a && b && b.raw !== a.raw) lines.push(`If your bot runs in Docker/sandbox: use join token: ${b.raw}`);
  return lines.join('\n').trim();
}

copyJoinTokenBtn?.addEventListener("click", () => copyText(joinTokenEl?.value));
copySandboxJoinTokenBtn?.addEventListener("click", () => copyText(sandboxJoinTokenEl?.value));

copyBotPromptBtn?.addEventListener("click", () => copyText(botPromptEl?.value));

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
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Any manual interaction takes over from H-Mode.
  ensureManualFromUserInput();
  if (you.mode !== "manual") return;

  const world = canvasToWorld(x, y);

  if (pendingTarget) {
    if (Date.now() <= pendingTargetUntilMs) {
      castSpell(pendingTarget.spell, world.x, world.y);
    }
    pendingTarget = null;
    pendingTargetUntilMs = 0;
    statusEl.textContent = t('status.connected');
    return;
  }

  ws.send(JSON.stringify({ type: "set_goal", x: world.x, y: world.y }));
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
  const isArrow = e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight";
  if (isArrow) e.preventDefault();
  if (e.key === "w" || e.key === "ArrowUp") keyState.up = true;
  if (e.key === "s" || e.key === "ArrowDown") keyState.down = true;
  if (e.key === "a" || e.key === "ArrowLeft") keyState.left = true;
  if (e.key === "d" || e.key === "ArrowRight") keyState.right = true;
});

window.addEventListener("keyup", (e) => {
  const tag = (e.target && e.target.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
  const isArrow = e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight";
  if (isArrow) e.preventDefault();
  if (e.key === "w" || e.key === "ArrowUp") keyState.up = false;
  if (e.key === "s" || e.key === "ArrowDown") keyState.down = false;
  if (e.key === "a" || e.key === "ArrowLeft") keyState.left = false;
  if (e.key === "d" || e.key === "ArrowRight") keyState.right = false;
});

function stepInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (!you) return;
  const t = Date.now();
  // Mobile joystick feels better with a slightly higher send rate.
  if (t - lastMoveSentAt < 50) return;
  lastMoveSentAt = t;

  const kdx = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
  const kdy = (keyState.down ? 1 : 0) - (keyState.up ? 1 : 0);

  // Joystick overrides keyboard input on mobile.
  const dx = joyState.active ? joyState.dx : kdx;
  const dy = joyState.active ? joyState.dy : kdy;
  if (dx === 0 && dy === 0) return;

  // If the player is in H-Mode but the user provides movement input, auto-takeover.
  if (you.mode !== "manual") {
    ensureManualFromUserInput();
  }
  if (you.mode !== "manual") return;
  ws.send(JSON.stringify({ type: "move", dx, dy }));
}

function renderHeader() {
  if (!you) return;
  const bs = you.baseStats || {};
  jobEl.textContent = `${t('label.job')}${jobName(you.job)}`;
  levelEl.textContent = lang === 'en'
    ? `${t('label.level')}${you.level} (${you.xp}/${you.xpToNext})`
    : `${t('label.level')}${you.level}（${you.xp}/${you.xpToNext}）`;
  modeManualBtn.classList.toggle("is-active", you.mode === "manual");
  modeAgentBtn.classList.toggle("is-active", you.mode === "agent");

  if (hudNameEl) hudNameEl.textContent = you.name;
  if (hudJobEl) hudJobEl.textContent = `${t('hud.job')}${jobName(you.job)}`;
  if (hudLevelEl) hudLevelEl.textContent = `${t('hud.level')}${you.level}`;
  if (hudModeEl) hudModeEl.textContent = you.mode === 'agent' ? t('hud.modeAgent') : t('hud.modeManual');
  if (hudBotEl) hudBotEl.textContent = you.linkedBot ? t('hud.botLinked') : t('hud.botUnlinked');

  // Mobile: show joystick only in manual mode.
  try {
    // Mobile: keep joystick visible so the user can always "take over" from H-Mode.
    const showJoy = isMobileLayout();
    if (stageEl) stageEl.classList.toggle("has-joystick", showJoy);
    if (joystickEl) {
      joystickEl.hidden = !showJoy;
      joystickEl.classList.toggle("is-disabled", showJoy && you.mode !== "manual");
    }
    if (!showJoy) {
      joyState.active = false;
      joyState.dx = 0;
      joyState.dy = 0;
      joyState.pointerId = null;
      if (joystickEl) joystickEl.classList.remove("is-active");
      if (joystickKnobEl) joystickKnobEl.style.transform = "translate3d(0,0,0)";
    }
  } catch {
    // ignore
  }

  if (slot1Name) {
    const n = (you.signatureSpell && you.signatureSpell.name) || t('action.slot1');
    slot1Name.textContent = n || t('action.slot1');
  }

  if (slot4Name) {
    const sk = jobSkillFor(you.job);
    slot4Name.textContent = sk.name;
    if (slot4) {
      const sp = String(sk.spell || "").trim();
      if (sp) slot4.dataset.spell = sp;
      else delete slot4.dataset.spell;
    }
  }

  if (killsEl) killsEl.textContent = `${t('label.kills')}${(you.meta && you.meta.kills) || 0}`;
  if (craftsEl) craftsEl.textContent = `${t('label.crafts')}${(you.meta && you.meta.crafts) || 0}`;
  if (pickupsEl) pickupsEl.textContent = `${t('label.pickups')}${(you.meta && you.meta.pickups) || 0}`;

  if (statPointsEl) statPointsEl.textContent = `${t('label.points')}${you.statPoints ?? 0}`;
  if (hpPillEl) hpPillEl.textContent = `${t('label.hp')}${you.hp ?? 0}/${you.maxHp ?? 0}`;
  if (statStrValEl) statStrValEl.textContent = String(bs.str ?? 1);
  if (statAgiValEl) statAgiValEl.textContent = String(bs.agi ?? 1);
  if (statVitValEl) statVitValEl.textContent = String(bs.vit ?? 1);
  if (statIntValEl) statIntValEl.textContent = String(bs.int ?? 1);
  if (statDexValEl) statDexValEl.textContent = String(bs.dex ?? 1);
  if (statLukValEl) statLukValEl.textContent = String(bs.luk ?? 1);

  const canAlloc = Number(you.statPoints || 0) > 0;
  for (const b of [allocStrBtn, allocAgiBtn, allocVitBtn, allocIntBtn, allocDexBtn, allocLukBtn]) {
    if (!b) continue;
    b.disabled = !canAlloc;
    b.title = canAlloc ? (lang === 'en' ? 'Allocate 1 point' : '分配 1 點') : (lang === 'en' ? 'No available points' : '沒有可用點數');
  }

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
  refreshAvatarPreview();
}

function renderParty() {
  if (!partyMembersEl || !state || !you) return;
  const pid = you.partyId;
  const parties = state.parties || [];
  const party = pid ? parties.find((p) => p && p.id === pid) : null;
  if (!party) {
    partyMembersEl.innerHTML = `<div class="helper">${lang === 'en' ? 'Not in a party yet.' : '尚未加入隊伍。'}</div>`;
    return;
  }

  const leaderId = party.leaderId;
  const rows = (party.members || []).map((m) => {
    const lead = m.id === leaderId ? (lang === 'en' ? '(Leader)' : '（隊長）') : '';
    const mode = m.mode === 'agent' ? t('hud.modeAgent') : t('hud.modeManual');
    return `<div class="item">
      <div class="meta"><span>${escapeHtml(m.name)} ${lead}</span><span>${escapeHtml(mode)} · Lv ${m.level}</span></div>
      <div class="content">${escapeHtml(jobName(m.job))} · HP ${m.hp}/${m.maxHp}</div>
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
  if (kills >= 1) list.push(lang === 'en' ? { title: 'First Blood', sub: 'Defeat your first monster.' } : { title: '初次擊殺', sub: '打倒你的第一隻怪物。' });
  if (kills >= 10) list.push(lang === 'en' ? { title: 'Slime Hunter I', sub: 'Defeat 10 monsters.' } : { title: '史萊姆獵人 I', sub: '擊殺 10 隻怪物。' });
  if (kills >= 50) list.push(lang === 'en' ? { title: 'Slime Hunter II', sub: 'Defeat 50 monsters.' } : { title: '史萊姆獵人 II', sub: '擊殺 50 隻怪物。' });
  if (crafts >= 1) list.push(lang === 'en' ? { title: 'Crafter', sub: 'Craft your first equipment.' } : { title: '工匠', sub: '完成你的第一次合成。' });
  if (crafts >= 10) list.push(lang === 'en' ? { title: 'Workshop Regular', sub: 'Craft 10 times.' } : { title: '工坊常客', sub: '合成 10 次。' });

  if (list.length === 0) {
    achievementsEl.innerHTML = `<div class="helper">${lang === 'en' ? 'No achievements yet. Go hunt slimes and craft gear.' : '還沒有成就。去打史萊姆、合成裝備吧。'}</div>`;
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
    craftJellyHintBtn.textContent = lang === 'en' ? `Need 3 Jelly (${jellyQty})` : `需要 3 Jelly（${jellyQty}）`;
  }
  if (craftJellyBtn) {
    craftJellyBtn.disabled = jellyQty < 3;
  }

  if (items.length === 0) {
    inventoryEl.innerHTML = `<div class="helper">${lang === 'en' ? 'Your inventory is empty. Go hunt slimes.' : '背包是空的。去打史萊姆吧。'}</div>`;
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
  // NOTE: Avoid clearing the canvas before we know we have a valid world snapshot.
  // iOS Safari (and flaky networks) can briefly deliver "no world yet" states during reconnects,
  // which would otherwise look like a distracting blink.
  if (!state || !state.world) return;

  const t = Number(state.world.tileSize);
  if (!Number.isFinite(t) || t <= 0) return;

  updateCamera();

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Mobile zoom + camera follow: transform world space into screen space.
    const z = Number(view.zoom || 1) || 1;
    ctx.scale(z, z);
    ctx.translate(-Number(view.camX || 0), -Number(view.camY || 0));

    drawTerrain(t);
    drawDrops();

    // fx
    const now = Date.now();
    // NOTE: createdAt comes from server time. If the client clock is behind, age can be negative.
    // Clamp to avoid negative radii / IndexSizeError in Canvas APIs (which can cause visible flicker).
    recentFx = (Array.isArray(recentFx) ? recentFx : []).filter((fx) => {
      const created = Date.parse(fx.createdAt);
      if (!Number.isFinite(created)) return false;
      const age = Math.max(0, now - created);
      return age < 1400;
    });
    for (const fx of recentFx) {
      ctx.save();
      try {
        const created = Date.parse(fx.createdAt);
        const age = Number.isFinite(created) ? Math.max(0, now - created) : 999999;
        const p = clamp01(1 - age / 1200);
        ctx.globalAlpha = p;

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
      } catch {
        // Never let a single bad fx event blank the whole frame.
      } finally {
        ctx.restore();
      }
    }

    try {
      drawMonsters();
    } catch {
      // ignore
    }

    // players
    const ps = Array.isArray(state.players) ? state.players : [];
    for (const p of ps) {
      ctx.save();
      try {
        const isYou = p.id === playerId;

        // shadow
        ctx.beginPath();
        ctx.fillStyle = "rgba(9,19,36,0.18)";
        ctx.ellipse(p.x, p.y + 10, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // avatar (custom uploads or default sprite)
        const AV_SIZE = 78; // slightly larger for readability + personality
        const avV = Number(p.avatarVersion || 0) || 0;
        const avUrl = avV > 0 ? `/api/avatars/${encodeURIComponent(p.id)}.png?v=${encodeURIComponent(String(avV))}` : "";
        const customImg = avUrl ? getCustomAvatarImg(avUrl) : null;
        let hasAvatar = false;

        if (customImg && customImg.complete && customImg.naturalWidth > 0) {
          const dw = AV_SIZE;
          const dh = AV_SIZE;
          const dx = p.x - dw / 2;
          const dy = p.y - dh + 22;
          try {
            ctx.drawImage(customImg, dx, dy, dw, dh);
            hasAvatar = true;
          } catch {
            // Broken/corrupt images should never blank the whole frame.
            hasAvatar = false;
          }
        } else if (avatarSpriteReady) {
          // Sprite sheet is a 5x8 grid (approx). Use a clean front-facing poring frame.
          const cellW = 134;
          const cellH = 112;
          const sx = 0;
          const sy = 1 * cellH;
          const sw = cellW;
          const sh = cellH;

          const dw = AV_SIZE;
          const dh = AV_SIZE;
          const dx = p.x - dw / 2;
          const dy = p.y - dh + 22;
          ctx.drawImage(avatarSprite, sx, sy, sw, sh, dx, dy, dw, dh);
          hasAvatar = true;
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

        // mode ring (shown when agent, or highlight yourself)
        if (hasAvatar && (p.mode === "agent" || isYou)) {
          ctx.strokeStyle = p.mode === "agent" ? "rgba(184,135,27,0.78)" : "rgba(43,108,176,0.72)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y + 10, 16, 0, Math.PI * 2);
          ctx.stroke();
        }

        // name
        ctx.font = "12px JetBrains Mono";
        ctx.fillStyle = "rgba(19,27,42,0.92)";
        ctx.textAlign = "center";
        const avatarTopY = p.y - AV_SIZE + 22;
        ctx.fillText(p.name, p.x, hasAvatar ? avatarTopY - 12 : p.y - 16);

        // intent (short)
        if (p.intent) {
          ctx.font = "11px Spline Sans";
          ctx.fillStyle = "rgba(19,27,42,0.66)";
          ctx.fillText(p.intent.slice(0, 30), p.x, p.y + 34);
        }

        const speech = localLastSpeech.get(p.id);
        if (speech && Date.now() - speech.atMs < 4500) {
          drawSpeechBubble(p.x, hasAvatar ? avatarTopY - 40 : p.y - 44, speech.text);
        }
      } catch {
        // Never let a single bad avatar/state frame blank the whole render.
      } finally {
        ctx.restore();
      }
    }
  } catch {
    // Never let a render error permanently kill the loop; worst case we miss a frame.
  } finally {
    try {
      ctx.restore();
    } catch {
      // ignore
    }
  }

  drawMinimap();
}

function drawMinimap() {
  if (!minimapEl || !minimapCtx || !state || !state.world) return;
  const w = minimapEl.width;
  const h = minimapEl.height;
  minimapCtx.clearRect(0, 0, w, h);

  // Background (soft) + border
  minimapCtx.fillStyle = "rgba(255,255,255,0.68)";
  minimapCtx.fillRect(0, 0, w, h);
  minimapCtx.strokeStyle = "rgba(19,27,42,0.18)";
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(1, 1, w - 2, h - 2);

  const worldW = Number(state.world.width) * Number(state.world.tileSize);
  const worldH = Number(state.world.height) * Number(state.world.tileSize);
  if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return;

  const scale = Math.min(w / worldW, h / worldH);
  const ox = (w - worldW * scale) / 2;
  const oy = (h - worldH * scale) / 2;
  const tx = (x) => ox + Number(x) * scale;
  const ty = (y) => oy + Number(y) * scale;

  // Drops
  try {
    for (const d of state.drops || []) {
      minimapCtx.fillStyle = "rgba(184,135,27,0.85)";
      minimapCtx.beginPath();
      minimapCtx.arc(tx(d.x), ty(d.y), 2.2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  } catch {
    // ignore
  }

  // Monsters
  try {
    for (const m of state.monsters || []) {
      if (!m || !m.alive) continue;
      const c = m.color ? String(m.color) : "rgba(52,199,89,0.9)";
      minimapCtx.fillStyle = c;
      minimapCtx.beginPath();
      minimapCtx.arc(tx(m.x), ty(m.y), 3, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  } catch {
    // ignore
  }

  // Players
  try {
    for (const p of state.players || []) {
      const isYou = p && p.id === playerId;
      const px = tx(p.x);
      const py = ty(p.y);
      minimapCtx.fillStyle = isYou ? "rgba(43,108,176,0.95)" : "rgba(15,118,110,0.85)";
      minimapCtx.beginPath();
      minimapCtx.arc(px, py, isYou ? 4 : 3, 0, Math.PI * 2);
      minimapCtx.fill();
      if (isYou) {
        minimapCtx.strokeStyle = "rgba(255,255,255,0.9)";
        minimapCtx.lineWidth = 2;
        minimapCtx.beginPath();
        minimapCtx.arc(px, py, 6.5, 0, Math.PI * 2);
        minimapCtx.stroke();
      }
    }
  } catch {
    // ignore
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
    const fill = (m.color && typeof m.color === 'string')
      ? String(m.color)
      : (m.kind === "slime" ? "rgba(52, 199, 89, 0.85)" : "rgba(255, 59, 48, 0.82)");
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
  if (!state || !state.world) return;
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

function maxCreatedAt(items) {
  const list = Array.isArray(items) ? items : [];
  let best = 0;
  for (const it of list) {
    const t = Date.parse(String(it && it.createdAt));
    if (Number.isFinite(t)) best = Math.max(best, t);
  }
  return best;
}

function maxChatCreatedAt(items) {
  // For unread purposes, ignore system spam. Count only "chat" kind.
  const list = Array.isArray(items) ? items : [];
  let best = 0;
  for (const it of list) {
    if (!it || it.kind !== "chat") continue;
    const t = Date.parse(String(it.createdAt));
    if (Number.isFinite(t)) best = Math.max(best, t);
  }
  return best;
}

function computeChatUnreadCount(items, sinceMs) {
  const list = Array.isArray(items) ? items : [];
  let n = 0;
  for (const it of list) {
    if (!it || it.kind !== "chat") continue;
    const t = Date.parse(String(it.createdAt));
    if (!Number.isFinite(t)) continue;
    if (t > sinceMs) n++;
  }
  return n;
}

function refreshChatFilterUI() {
  const set = (btn, active) => {
    if (!btn) return;
    btn.classList.toggle("is-active", Boolean(active));
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  };
  set(chatFilterAllBtn, chatFilter === "all");
  set(chatFilterPeopleBtn, chatFilter === "people");
  set(chatFilterSystemBtn, chatFilter === "system");
}

function setChatFilter(next, { persist = true } = {}) {
  const v = String(next || "").trim().toLowerCase();
  const chosen = v === "people" || v === "system" ? v : "all";
  chatFilter = chosen;
  refreshChatFilterUI();
  if (persist) {
    try {
      localStorage.setItem(CHAT_FILTER_KEY, chosen);
    } catch {
      // ignore
    }
  }
  renderChat();
}

chatFilterAllBtn?.addEventListener("click", () => setChatFilter("all"));
chatFilterPeopleBtn?.addEventListener("click", () => setChatFilter("people"));
chatFilterSystemBtn?.addEventListener("click", () => setChatFilter("system"));
refreshChatFilterUI();

function chatItemsForFilter(items) {
  const list = Array.isArray(items) ? items : [];
  if (chatFilter === "system") return list.filter((c) => c && c.kind === "system");
  if (chatFilter === "people") return list.filter((c) => c && c.kind === "chat");
  return list;
}

function renderChat() {
  if (!chatEl) return;
  const list = chatItemsForFilter((state && state.chats) || []);
  if (list.length === 0) {
    const hint =
      chatFilter === "system"
        ? (lang === "en" ? "No system messages yet." : "目前沒有系統訊息。")
        : chatFilter === "people"
          ? (lang === "en" ? "No player messages yet." : "目前沒有玩家聊天。")
          : (lang === "en" ? "No chat yet." : "目前沒有聊天。");
    chatEl.innerHTML = `<div class="helper">${escapeHtml(hint)}</div>`;
    return;
  }
  renderFeed(chatEl, list, "chat");
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

function isLikelyZh(s) {
  return /[\u4E00-\u9FFF]/.test(String(s || ''));
}

function botThoughtsByLang(chats, lang) {
  const all = botThoughtsFromChats(chats);
  if (lang === 'en') return all.filter((c) => !isLikelyZh(c.text));
  return all.filter((c) => isLikelyZh(c.text));
}

function renderBotThoughts() {
  const chats = (state && state.chats) || [];

  const selected = lang === 'en' ? 'en' : 'zh';
  const items = botThoughtsByLang(chats, selected);
  const all = botThoughtsFromChats(chats);
  const otherCount = Math.max(0, all.length - items.length);

  if (botLogEl) {
    if (items.length === 0) {
      const hint = selected === 'en'
        ? (otherCount > 0 ? 'No English bot thoughts yet (try switching to 繁中).' : 'No bot thoughts yet.')
        : (otherCount > 0 ? '目前沒有中文 Bot 想法（可切到 EN 看）。' : '目前沒有 Bot 想法。');
      botLogEl.innerHTML = `<div class="helper">${escapeHtml(hint)}</div>`;
    } else {
      renderFeed(botLogEl, items, 'chat');
    }
  }

  // Status line: help users tell "linked" vs "online".
  if (botStatusEl) {
    const b = you && you.bot;
    if (!you) {
      botStatusEl.textContent = lang === 'en' ? 'Loading player state…' : '尚未載入角色狀態。';
    } else if (!you.linkedBot) {
      botStatusEl.textContent = lang === 'en'
        ? 'Bot not linked. Go to “Link Bot” to generate a Join Token.'
        : '尚未連結 Bot。去「連結 Bot」產生 Join Token。';
    } else {
      const now = Date.now();
      const seenAt = b && Number(b.lastSeenAt || 0);
      const actionAt = b && Number(b.lastActionAt || 0);
      const seenAgo = seenAt ? now - seenAt : null;
      const actionAgo = actionAt ? now - actionAt : null;

      if (!seenAgo || seenAgo > 12_000) {
        botStatusEl.textContent = lang === 'en'
          ? 'Linked, but bot seems offline (no bot API calls seen). Paste the prompt into Moltbot / Telegram and try again.'
          : '已連結，但 Bot 目前未上線（沒有收到任何 Bot API 呼叫）。把 Prompt 貼到 Moltbot / Telegram 後再觀察。';
      } else if (!actionAgo || actionAgo > 12_000) {
        botStatusEl.textContent = lang === 'en'
          ? 'Bot is online, but no recent actions (no goal/cast/intent). Check Moltbot logs or rate limits.'
          : 'Bot 已上線，但最近沒有動作（沒有 goal/cast/intent）。請檢查 Moltbot 是否卡住，或看是否被 rate limit。';
      } else {
        const thought = b && String(b.thought || '').trim();
        botStatusEl.textContent = thought
          ? (lang === 'en' ? `Bot is online. Latest thought: ${thought}` : `Bot 已上線。最新想法：${thought}`)
          : (lang === 'en' ? 'Bot is online and acting.' : 'Bot 已上線並在行動中。');
      }
    }
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function connect() {
  statusEl.textContent = t('status.connecting');
  const qs = new URLSearchParams({ playerId, name: myName });
  ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws?${qs.toString()}`);

  ws.addEventListener("open", () => {
    statusEl.textContent = t('status.connected');
  });

  ws.addEventListener("close", () => {
    statusEl.textContent = t('status.reconnecting');
    setTimeout(connect, 500);
  });

  function acceptState(next) {
    // Defensive: never allow a malformed state payload to blank the map.
    // (We've observed mobile browsers occasionally ending up with "state: undefined" UI.)
    if (!next || typeof next !== "object") return false;
    if (!next.world || typeof next.world !== "object") return false;
    if (!Array.isArray(next.players)) return false;
    state = next;
    lastGoodState = next;
    window.__ct = window.__ct || {};
    window.__ct.state = state;
    return true;
  }

  ws.addEventListener("message", (e) => {
    let msg;
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    try {
      if (msg.type === "hello") {
        you = msg.you;
        if (!acceptState(msg.state)) return;
      window.__ct = window.__ct || {};
      window.__ct.you = you;
      recentFx = (msg.recentFx || []).concat(recentFx);
      window.__ct.recentFx = recentFx;

      coach?.onHello?.(you);

      renderHeader();
      renderFeed(boardEl, state.board || [], "board");
      renderChat();
      renderBotThoughts();
      refreshHat();
      try {
        // Unread counts: compute against last seen timestamps. No accumulation to avoid flapping.
        const chatMax = maxChatCreatedAt(state.chats || []);
        const boardMax = maxCreatedAt(state.board || []);

        // First boot: don't show unread badges for the initial snapshot.
        if (!unread.chatSeenAt) unread.chatSeenAt = chatMax;
        if (!unread.boardSeenAt) unread.boardSeenAt = boardMax;

        if (activeTabKey !== "chat") {
          unread.chatCount = Math.min(999, computeChatUnreadCount(state.chats || [], unread.chatSeenAt || 0));
        } else {
          unread.chatCount = 0;
          unread.chatSeenAt = Math.max(unread.chatSeenAt || 0, chatMax);
        }

        if (activeTabKey !== "board") {
          const since = unread.boardSeenAt || 0;
          let n = 0;
          for (const it of state.board || []) {
            const t = Date.parse(String(it && it.createdAt));
            if (Number.isFinite(t) && t > since) n++;
          }
          unread.boardCount = Math.min(999, n);
        } else {
          unread.boardCount = 0;
          unread.boardSeenAt = Math.max(unread.boardSeenAt || 0, boardMax);
        }

        persistUnread();
        renderBadges();
      } catch {
        // ignore
      }
      coach?.onState?.(you, state, recentFx);
      return;
    }
    if (msg.type === "state") {
      if (!acceptState(msg.state)) return;
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

      // Also show structured bot thoughts as speech bubbles (without spamming chat).
      // Allow a bit of clock skew between server and client.
      const now = Date.now();
      for (const pp of state.players || []) {
        const b = pp && pp.bot;
        const text = b && String(b.thought || "").trim();
        const at = b && Number(b.thoughtAt || 0);
        if (!text || !Number.isFinite(at) || at <= 0) continue;
        if (Math.abs(now - at) > 25_000) continue;
        const prev = localLastSpeech.get(pp.id);
        if (!prev || at > prev.atMs) localLastSpeech.set(pp.id, { text: `[BOT] ${text}`.slice(0, 200), atMs: at });
      }

      renderHeader();
      renderFeed(boardEl, state.board || [], "board");
      renderChat();
      renderBotThoughts();
      draw();
      try {
        const chatMax = maxChatCreatedAt(state.chats || []);
        const boardMax = maxCreatedAt(state.board || []);
        if (activeTabKey !== "chat") {
          unread.chatCount = Math.min(999, computeChatUnreadCount(state.chats || [], unread.chatSeenAt || 0));
        } else {
          unread.chatCount = 0;
          unread.chatSeenAt = Math.max(unread.chatSeenAt || 0, chatMax);
        }
        if (activeTabKey !== "board") {
          // Count board unread (simple count since timestamp).
          const since = unread.boardSeenAt || 0;
          let n = 0;
          for (const it of state.board || []) {
            const t = Date.parse(String(it && it.createdAt));
            if (Number.isFinite(t) && t > since) n++;
          }
          unread.boardCount = Math.min(999, n);
        } else {
          unread.boardCount = 0;
          unread.boardSeenAt = Math.max(unread.boardSeenAt || 0, boardMax);
        }
        persistUnread();
        renderBadges();
      } catch {
        // ignore
      }
      coach?.onState?.(you, state, recentFx);
      return;
    }
    if (msg.type === "fx") {
      recentFx.unshift(msg.fx);
      window.__ct = window.__ct || {};
      window.__ct.recentFx = recentFx;
      coach?.onState?.(you, state, recentFx);
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
    } catch {
      // Keep the game playable even if one message handler fails.
      // Prefer continuing with the last good state rather than blanking the map.
      if (lastGoodState && (!state || !state.world)) state = lastGoodState;
    }
  });
}

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
      openTab("link");
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
