import { test, expect } from '@playwright/test';

async function closeOnboarding(page: any) {
  const modal = page.locator('#onboarding');
  if (await modal.isVisible().catch(() => false)) {
    await page.locator('#onboardingStart').click();
    await expect(modal).toBeHidden();
  }
}

async function waitForFonts(page: any) {
  // Fonts are loaded from Google Fonts and may be blocked in some CI/network.
  // We treat fonts as a best-effort wait to reduce screenshot flakiness.
  await page
    .waitForFunction(() => !(document as any).fonts || (document as any).fonts.status === 'loaded', null, { timeout: 5000 })
    .catch(() => {});
}

async function resetWorld(page: any) {
  const res = await page.request.post('/api/debug/reset');
  const data = await res.json();
  expect(data?.ok).toBeTruthy();
}

test('UI baseline looks polished', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#actionbar')).toBeVisible();
  await expect(page.locator('.ui-window')).toBeVisible();
  await expect(page.locator('.ui-tab[data-tab="character"]')).toBeVisible();

  await page.waitForFunction(() => {
    const st = (window as any).__ct?.state;
    return st && Array.isArray(st.monsters) && st.monsters.length >= 1;
  });

  await expect(page.locator('#actionbar')).toHaveScreenshot('actionbar.png');

  // Mask dynamic feeds (timestamps + messages).
  await expect(page).toHaveScreenshot('clawtown-home.png', {
    mask: [page.locator('#chat'), page.locator('#board'), page.locator('#status')],
    fullPage: true,
  });
});

test('Combat: hotkey 1 damages a nearby monster', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.waitForFunction(() => {
    const st = (window as any).__ct?.state;
    return st && Array.isArray(st.monsters) && st.monsters.length >= 1;
  });

  // Make the scenario deterministic: use bot API to walk next to a monster,
  // then switch back to manual and validate hotkey 1 (WS cast) damages.
  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  expect(joinData.ok).toBeTruthy();

  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();
  const botToken = linkData.botToken;

  // pick nearest target from bot world snapshot
  const wbRes = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
  const wb = await wbRes.json();
  const you0 = wb.snapshot?.you;
  expect(you0).toBeTruthy();
  const alive = (wb.snapshot?.monsters || []).filter((m: any) => m && m.alive);
  expect(alive.length).toBeGreaterThan(0);

  const dist2 = (m: any) => {
    const dx = (m.x || 0) - (you0.x || 0);
    const dy = (m.y || 0) - (you0.y || 0);
    return dx * dx + dy * dy;
  };
  alive.sort((a: any, b: any) => dist2(a) - dist2(b));
  const target = alive[0];

  // move there using agent goal (polling bot world so we don't depend on WS updates)
  const modeRes = await page.request.post('/api/bot/mode', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { mode: 'agent' },
  });
  expect(modeRes.ok()).toBeTruthy();

  const goalRes = await page.request.post('/api/bot/goal', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { x: target.x, y: target.y },
  });
  expect(goalRes.ok()).toBeTruthy();

  const goalX = target.x;
  const goalY = target.y;
  for (let i = 0; i < 60; i++) {
    const w = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
    const d = await w.json();
    const y = d.snapshot?.you;
    if (y) {
      const dx = y.x - goalX;
      const dy = y.y - goalY;
      if (Math.sqrt(dx * dx + dy * dy) < 120) break;
    }
    await page.waitForTimeout(200);
  }

  // switch back to manual and use hotkey 1
  await page.locator('#modeManual').click();
  await page.waitForFunction(() => (window as any).__ct?.you?.mode === 'manual');

  const beforeWorld = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
  const bw = await beforeWorld.json();
  const before: Record<string, number> = {};
  for (const m of bw.snapshot?.monsters || []) {
    if (!m.alive) continue;
    before[m.id] = m.hp;
  }

  await page.locator('#game').click({ position: { x: 20, y: 20 } });

  for (let attempt = 0; attempt < 7; attempt++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(900);

    const afterWorld = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
    const aw = await afterWorld.json();
    const changed = (aw.snapshot?.monsters || []).some((m: any) => m.alive && before[m.id] != null && m.hp < before[m.id]);
    if (changed) return;
  }

  const afterWorld = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
  const aw = await afterWorld.json();
  const changed = (aw.snapshot?.monsters || []).some((m: any) => m.alive && before[m.id] != null && m.hp < before[m.id]);
  expect(changed).toBeTruthy();
});

test('Input: arrow keys do not scroll the page', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const y0 = await page.evaluate(() => window.scrollY);
  expect(y0).toBe(0);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(120);
  const y1 = await page.evaluate(() => window.scrollY);
  expect(y1).toBe(0);
});

test('World: spawns 5 colored slimes', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const out = await page.waitForFunction(() => {
    const mons = (globalThis as any).__ct?.state?.monsters;
    if (!Array.isArray(mons) || mons.length === 0) return null;
    const slimes = mons.filter((m: any) => m && m.alive && m.kind === 'slime');
    if (slimes.length < 5) return null;
    const colors = slimes.map((m: any) => String(m.color || '')).filter(Boolean);
    const uniq = new Set(colors);
    return { slimeCount: slimes.length, colorCount: colors.length, uniqCount: uniq.size };
  });

  const v = await out.jsonValue();
  expect(v.slimeCount).toBeGreaterThanOrEqual(5);
  expect(v.colorCount).toBeGreaterThanOrEqual(5);
  expect(v.uniqCount).toBeGreaterThanOrEqual(5);
});

test('Layout: right panel scroll does not move map', async ({ page }) => {
  await resetWorld(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const canvas = page.locator('#game');
  const body = page.locator('.ui-window-body');
  await expect(body).toBeVisible();

  const y0 = await page.evaluate(() => window.scrollY);
  expect(y0).toBe(0);

  const box0 = await canvas.boundingBox();
  expect(box0).toBeTruthy();

  const st0 = await page.evaluate(() => {
    const el = document.querySelector('.ui-window-body');
    return el ? (el as HTMLElement).scrollTop : -1;
  });
  expect(st0).toBe(0);

  await body.hover();
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(150);

  const st1 = await page.evaluate(() => {
    const el = document.querySelector('.ui-window-body');
    return el ? (el as HTMLElement).scrollTop : -1;
  });
  expect(st1).toBeGreaterThan(0);

  const y1 = await page.evaluate(() => window.scrollY);
  expect(y1).toBe(0);

  const box1 = await canvas.boundingBox();
  expect(box1).toBeTruthy();
  expect(Math.round((box1 as any).y)).toBe(Math.round((box0 as any).y));
});

test('Sorting Hat produces a result', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.locator('.ui-tab[data-tab="hat"]').click();
  await expect(page.locator('#hatOptions')).toBeVisible();

  await page.locator('#hatOptions .hat-choice', { hasText: '戰鬥' }).click();
  await page.locator('#hatOptions .hat-choice', { hasText: '正面上' }).click();
  await page.locator('#hatOptions .hat-choice', { hasText: '力量' }).click();

  await expect(page.locator('#hatFreeWrap')).toHaveClass(/is-active/);
  await page.locator('#hatFreeSkip').click();
  await expect(page.locator('#hatResult')).toContainText('專屬招式');

  await expect(page.locator('#tab-hat')).toHaveScreenshot('hat-panel.png', {
    mask: [page.locator('#status')],
  });
});

test('Join code generation works', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.locator('.ui-tab[data-tab="link"]').click();
  await page.locator('#makeJoinCode').click();
  await expect(page.locator('#joinCode')).toHaveText(/[A-Z2-9]{6}/);
  await expect(page.locator('#joinToken')).toHaveValue(/CT1\|http:\/\/127\.0\.0\.1:3100\|[A-Z2-9]{6}/);
});

test('Join token can be used to link a bot', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.locator('.ui-tab[data-tab="link"]').click();
  await page.locator('#makeJoinCode').click();
  await expect(page.locator('#joinCode')).toHaveText(/[A-Z2-9]{6}/);
  await expect(page.locator('#joinToken')).toHaveValue(/CT1\|http:\/\//);
  const joinToken = await page.locator('#joinToken').inputValue();
  const parts = joinToken.split('|');
  expect(parts[0]).toBe('CT1');
  expect(parts[2]).toMatch(/^[A-Z2-9]{6}$/);

  // Simulate bot calling the server using the code.
  await page.request.post('/api/bot/link', { data: { joinCode: parts[2] } });

  await expect(page.locator('#hudBot')).toContainText('已連結');
});

test('Skill 4: targeted fireball damages monsters', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.waitForFunction(() => {
    const st = (window as any).__ct?.state;
    return st && Array.isArray(st.monsters) && st.monsters.length >= 1;
  });

  // Use bot API to make the test deterministic.
  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  expect(joinData.ok).toBeTruthy();
  expect(joinData.joinCode).toMatch(/[A-Z2-9]{6}/);

  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();
  expect(linkData.botToken).toBeTruthy();
  const botToken = linkData.botToken;

  // Find a live monster and cast directly on it (avoid relying on where slimes wandered).
  let wb: any = null;
  for (let i = 0; i < 12; i++) {
    const r = await page.request.get('/api/bot/world', {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    wb = await r.json();
    const alive = (wb.snapshot?.monsters || []).filter((m: any) => m && m.alive);
    if (alive.length) break;
    await page.waitForTimeout(600);
  }

  const alive = (wb.snapshot?.monsters || []).filter((m: any) => m && m.alive);
  expect(alive.length).toBeGreaterThan(0);
  const t = alive[0];

  const beforeHp: Record<string, number> = {};
  const beforeAlive: Record<string, boolean> = {};
  for (const m of wb.snapshot?.monsters || []) {
    beforeAlive[m.id] = Boolean(m.alive);
    if (m.alive) beforeHp[m.id] = m.hp;
  }

  await page.request.post('/api/bot/cast', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { spell: 'fireball', x: t.x, y: t.y },
  });

  let changed = false;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(200);
    const waRes = await page.request.get('/api/bot/world', {
      headers: { Authorization: `Bearer ${botToken}` },
    });
    const wa = await waRes.json();
    changed = (wa.snapshot?.monsters || []).some((m: any) => {
      const prevAlive = beforeAlive[m.id];
      const prevHp = beforeHp[m.id];
      if (prevAlive === true && m.alive === false) return true;
      if (prevHp != null && typeof m.hp === 'number' && m.hp < prevHp) return true;
      return false;
    });
    if (changed) break;
  }
  expect(changed).toBeTruthy();
});

test('Bot tab shows [BOT] thoughts', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  await page.locator('.ui-tab[data-tab="chat"]').click();
  await page.locator('#chatInput').fill('[BOT] planning: hunt slimes, save for gear');
  await page.locator('#chatSend').click();

  // Switch UI language to English so Bot Thoughts view shows English entries.
  await page.locator('#langEn').click();

  await page.locator('.ui-tab[data-tab="bot"]').click();
  await expect(page.locator('#botLog')).toContainText('planning: hunt slimes');
});

test('VFX: arrow cast produces arrow fx', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  expect(joinData.ok).toBeTruthy();

  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();
  const botToken = linkData.botToken;

  await page.request.post('/api/bot/mode', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { mode: 'agent' },
  });

  await page.request.post('/api/bot/cast', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { spell: 'arrow' },
  });

  await page.waitForFunction(() => {
    const fx = (window as any).__ct?.recentFx;
    if (!Array.isArray(fx)) return false;
    return fx.some((e: any) => String(e?.type || '') === 'arrow');
  });
});

test('Loot: defeating a monster drops loot and auto-picks it up', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  // Place player at a deterministic spot and spawn a low-HP slime right next to them.
  await page.request.post('/api/debug/teleport', { data: { playerId, x: 520, y: 300 } });
  // Spawn the target exactly on the player to guarantee targeting + pickup.
  await page.request.post('/api/debug/spawn-monster', { data: { id: 'm_test_slime', kind: 'slime', name: 'Test Poring', x: 520, y: 300, maxHp: 1, hp: 1 } });

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  expect(joinData.ok).toBeTruthy();

  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();
  const botToken = linkData.botToken;

  // Kill the monster quickly.
  for (let i = 0; i < 3; i++) {
    await page.request.post('/api/bot/cast', {
      headers: { Authorization: `Bearer ${botToken}` },
      data: { spell: 'signature' },
    });
    await page.waitForTimeout(120);
  }

  // Wait until either zeny or an item appears in inventory (auto-pickup).
  let ok = false;
  for (let i = 0; i < 80; i++) {
    const w = await page.request.get('/api/bot/world', { headers: { Authorization: `Bearer ${botToken}` } });
    const data = await w.json();
    const y = data.snapshot?.you;
    const inv = Array.isArray(y?.inventory) ? y.inventory : [];
    const z = Number(y?.zenny || 0);
    if (z > 0 || inv.length > 0) {
      ok = true;
      break;
    }
    await page.waitForTimeout(150);
  }
  expect(ok).toBeTruthy();
});

test('Inventory: equipping a weapon updates stats', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'sword_1', qty: 1 } });

  // Open inventory tab and equip.
  await page.locator('.ui-tab[data-tab="inventory"]').click();
  await expect(page.locator('#inventory')).toContainText('Training Sword');

  const atkBeforeText = await page.locator('#atk').textContent();
  const atkBefore = Number(String(atkBeforeText || '').replace(/[^0-9]/g, ''));
  await page.locator('#inventory button[data-equip="sword_1"]').click();

  await expect(page.locator('#equipWeapon')).toContainText('Training Sword');
  await page.waitForTimeout(300);
  const atkAfterText = await page.locator('#atk').textContent();
  const atkAfter = Number(String(atkAfterText || '').replace(/[^0-9]/g, ''));
  expect(atkAfter).toBeGreaterThan(atkBefore);
});

test('Crafting: 3 jelly crafts a random equipment', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'jelly', qty: 3 } });

  await page.locator('.ui-tab[data-tab="inventory"]').click();
  await expect(page.locator('#craftJelly')).toBeEnabled();
  await expect(page.locator('#craftJellyHint')).toContainText('3');

  await page.locator('#craftJelly').click();

  // reward shows up in inventory
  await expect(page.locator('#inventory')).toContainText(/Beginner Dagger|Training Sword|Feather Bow|Cloth Armor|Copper Ring/);
});

test('Bot: auto-equips better weapon on pickup', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();
  const botToken = linkData.botToken;

  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'dagger_1', qty: 1 } });
  await page.waitForTimeout(150);
  const me1 = await (await page.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${botToken}` } })).json();
  expect(me1.player?.equipment?.weapon).toBe('dagger_1');

  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'sword_1', qty: 1 } });
  await page.waitForTimeout(150);
  const me2 = await (await page.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${botToken}` } })).json();
  expect(me2.player?.equipment?.weapon).toBe('sword_1');
});

test('Achievements: kill counter increases', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.request.post('/api/debug/teleport', { data: { playerId, x: 520, y: 300 } });
  await page.request.post('/api/debug/spawn-monster', { data: { id: 'm_ach_slime', kind: 'slime', name: 'Ach Poring', x: 520, y: 300, maxHp: 1, hp: 1 } });

  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  const botToken = linkData.botToken;

  await page.request.post('/api/bot/cast', {
    headers: { Authorization: `Bearer ${botToken}` },
    data: { spell: 'signature' },
  });

  await page.waitForTimeout(250);
  await expect(page.locator('#kills')).toContainText('1');
});

test('Persistence: inventory/equipment survives restart (CT_TEST)', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'sword_1', qty: 1 } });
  await page.request.post('/api/debug/grant-item', { data: { playerId, itemId: 'zenny', qty: 25 } });

  await page.locator('.ui-tab[data-tab="inventory"]').click();
  await expect(page.locator('#inventory')).toContainText('Training Sword');
  await page.locator('#inventory button[data-equip="sword_1"]').click();
  await expect(page.locator('#equipWeapon')).toContainText('Training Sword');

  await page.request.post('/api/debug/persist-flush', { data: { playerId } });
  await page.request.post('/api/debug/restart-sim');

  await page.reload();
  await waitForFonts(page);

  await page.locator('.ui-tab[data-tab="inventory"]').click();
  await expect(page.locator('#equipWeapon')).toContainText('Training Sword');
  await expect(page.locator('#zenny')).toContainText('25');
});

test('Stats: allocating STR increases ATK and persists (CT_TEST)', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.waitForFunction(() => {
    const y = (window as any).__ct?.you;
    return y && typeof y.level === 'number' && y.stats && typeof y.stats.atk === 'number';
  });

  const atkBeforeText = await page.locator('#atk').textContent();
  const atkBefore = Number(String(atkBeforeText || '').replace(/[^0-9]/g, ''));
  const strBeforeText = await page.locator('#statStrVal').textContent();
  const strBefore = Number(String(strBeforeText || '').replace(/[^0-9]/g, ''));

  await page.locator('#allocStr').click();

  await page.waitForFunction(
    (args: any) => {
      const y = (window as any).__ct?.you;
      if (!y) return false;
      const atk = Math.floor((y.stats && y.stats.atk) || 0);
      const str = Number((y.baseStats && y.baseStats.str) || 0);
      return atk > args.atkBefore && str === args.strBefore + 1;
    },
    { atkBefore, strBefore },
  );

  await page.request.post('/api/debug/persist-flush', { data: { playerId } });
  await page.request.post('/api/debug/restart-sim');

  await page.reload();
  await waitForFonts(page);

  await page.waitForFunction(
    (args: any) => {
      const y = (window as any).__ct?.you;
      if (!y) return false;
      const str = Number((y.baseStats && y.baseStats.str) || 0);
      return str === args.strAfter;
    },
    { strAfter: strBefore + 1 },
  );

  await expect(page.locator('#statStrVal')).toContainText(String(strBefore + 1));
});

test('H-Mode: linked bot autopilot moves and fights', async ({ page }) => {
  await resetWorld(page);
  await page.goto('/');
  await waitForFonts(page);
  await closeOnboarding(page);

  const playerId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId || null;
    } catch {
      return null;
    }
  });
  expect(playerId).toBeTruthy();

  await page.request.post('/api/debug/teleport', { data: { playerId, x: 520, y: 300 } });
  await page.request.post('/api/debug/spawn-monster', { data: { id: 'm_auto_slime', kind: 'slime', name: 'Auto Poring', x: 520, y: 300, maxHp: 1, hp: 1 } });

  // Link a bot (no external bot loop needed).
  const join = await page.request.post('/api/join-codes', { data: { playerId } });
  const joinData = await join.json();
  expect(joinData.ok).toBeTruthy();
  const link = await page.request.post('/api/bot/link', { data: { joinCode: joinData.joinCode } });
  const linkData = await link.json();
  expect(linkData.ok).toBeTruthy();

  // Switch to H-Mode; autopilot should take over and kill the spawned slime.
  await page.locator('#modeAgent').click();
  await expect(page.locator('#kills')).toContainText('1', { timeout: 10_000 });

  // Bot thoughts should show at least one line.
  await page.locator('.ui-tab[data-tab="bot"]').click();
  await expect(page.locator('#botLog')).toContainText('[BOT]');
});

test('Two players can chat (local multiplayer)', async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 780 } });
  const ctxB = await browser.newContext({ viewport: { width: 1200, height: 780 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await resetWorld(a);

  await a.goto('/');
  await b.goto('/');
  await waitForFonts(a);
  await waitForFonts(b);
  await closeOnboarding(a);
  await closeOnboarding(b);

  await a.locator('#name').fill('Alice');
  await a.locator('#name').press('Enter');
  await b.locator('#name').fill('Bob');
  await b.locator('#name').press('Enter');

  await b.locator('.ui-tab[data-tab="chat"]').click();
  await b.locator('#chatInput').fill('Hello Alice');
  await b.locator('#chatSend').click();

  await a.locator('.ui-tab[data-tab="chat"]').click();
  await expect(a.locator('#chat')).toContainText('Hello Alice');

  await ctxA.close();
  await ctxB.close();
});

test('Party: create/join and share XP on elite kill', async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 780 } });
  const ctxB = await browser.newContext({ viewport: { width: 1200, height: 780 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await resetWorld(a);

  await a.goto('/');
  await b.goto('/');
  await waitForFonts(a);
  await waitForFonts(b);
  await closeOnboarding(a);
  await closeOnboarding(b);

  const playerA = await a.evaluate(() => JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId);
  const playerB = await b.evaluate(() => JSON.parse(localStorage.getItem('clawtown.player') || 'null')?.playerId);
  expect(playerA).toBeTruthy();
  expect(playerB).toBeTruthy();

  // Link both to get bot tokens.
  const joinA = await a.request.post('/api/join-codes', { data: { playerId: playerA } });
  const codeA = (await joinA.json()).joinCode;
  const tokA = (await (await a.request.post('/api/bot/link', { data: { joinCode: codeA } })).json()).botToken;

  const joinB = await b.request.post('/api/join-codes', { data: { playerId: playerB } });
  const codeB = (await joinB.json()).joinCode;
  const tokB = (await (await b.request.post('/api/bot/link', { data: { joinCode: codeB } })).json()).botToken;

  // Create party on A, generate join code, join with B via UI.
  await a.locator('.ui-tab[data-tab="party"]').click();
  await a.locator('#partyCreate').click();
  await a.locator('#partyMakeCode').click();
  await a.waitForTimeout(250);
  const pcode = await a.locator('#partyCode').inputValue();
  expect(pcode).toMatch(/[A-Z2-9]{6}/);

  await b.locator('.ui-tab[data-tab="party"]').click();
  await b.locator('#partyJoinCode').fill(pcode);
  await b.locator('#partyJoin').click();

  // Wait until party is visible with 2 members.
  await a.waitForFunction(() => {
    const st = (window as any).__ct?.state;
    const you = (window as any).__ct?.you;
    if (!st || !you) return false;
    const party = (st.parties || []).find((p: any) => p && p.id === you.partyId);
    return party && Array.isArray(party.members) && party.members.length === 2;
  });

  // Summon elite (leader-only) + cost.
  await a.request.post('/api/debug/teleport', { data: { playerId: playerA, x: 520, y: 300 } });
  await b.request.post('/api/debug/teleport', { data: { playerId: playerB, x: 520, y: 300 } });
  await a.request.post('/api/debug/grant-item', { data: { playerId: playerA, itemId: 'zenny', qty: 30 } });
  await a.locator('#partySummon').click();

  // Elite should appear.
  await a.waitForFunction(() => {
    const st = (window as any).__ct?.state;
    if (!st) return false;
    return (st.monsters || []).some((m: any) => m && m.kind === 'elite' && m.alive);
  });

  // Shared XP on elite kill (deterministic): spawn a 1hp elite on the party and kill it.
  await a.request.post('/api/debug/spawn-monster', { data: { id: 'm_party_elite', kind: 'elite', name: 'Party Elite', x: 520, y: 300, maxHp: 1, hp: 1 } });

  const xpA0 = Number((await (await a.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${tokA}` } })).json()).player?.xp || 0);
  const xpB0 = Number((await (await b.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${tokB}` } })).json()).player?.xp || 0);

  await a.request.post('/api/bot/cast', { headers: { Authorization: `Bearer ${tokA}` }, data: { spell: 'signature' } });
  await a.waitForTimeout(300);

  const xpA1 = Number((await (await a.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${tokA}` } })).json()).player?.xp || 0);
  const xpB1 = Number((await (await b.request.get('/api/bot/me', { headers: { Authorization: `Bearer ${tokB}` } })).json()).player?.xp || 0);

  expect(xpA1).toBeGreaterThanOrEqual(xpA0 + 30);
  expect(xpB1).toBeGreaterThanOrEqual(xpB0 + 30);
});

test('Party: invalid invite code is rejected', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 780 } });
  const p = await ctx.newPage();

  await resetWorld(p);
  await p.goto('/');
  await waitForFonts(p);
  await closeOnboarding(p);

  await p.locator('.ui-tab[data-tab="party"]').click();
  await p.locator('#partyJoinCode').fill('AAAAAA');
  await p.locator('#partyJoin').click();

  await expect(p.locator('#status')).toContainText('隊伍');
});
