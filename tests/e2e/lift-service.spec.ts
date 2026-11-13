import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR || process.env.E2E_OUT || 'test-results';
type Office = {
  liftService: { state: () => { phase: string | null, left: number, service: boolean, tech: { offstage: boolean } | null, sticker: boolean, barrier: boolean },
    stairs: () => { down: string[], up: string[], open: number }, finish: () => boolean, extend: (secs?: number) => boolean, call: (s?: number) => boolean },
  chat: { msgs: { text?: string }[] },
  sessions: Map<string, object>, workers: Map<string, { station?: string, pos: { x: number, y: number }, goHomeNow: () => void, comeBack: () => void }>, upsert: (s: object) => void, pauseDemo: () => void, speed: (n: number) => void,
  fp: { pos: { set: (x: number, z: number) => void }, yaw: number, pitch: number }, view: (x: number, y: number, z: number, zoom: number) => void,
};
type Win = { __office?: Office };

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebGL/i.test(m.text())) errors.push(m.text()); });
  return errors;
}
async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const tag = await page.addStyleTag({ content: '.fp-help, .zc-peek, .toast, #fp-near { visibility: hidden !important }' });
  await page.screenshot({ path: path.join(SHOTS, name) });
  await tag.evaluate((n) => (n as Element).remove());
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
});

// the demo's people all resting, the office sped up
async function resting(page: Page, query: string) {
  await page.goto(`/?demo=claude&debug&layout=pro&${query}`);
  await page.waitForFunction(() => { const o = (window as unknown as Win).__office; return o?.workers?.size && o.liftService?.state().phase === 'work'; }, null, { timeout: 60_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(6); });
}

test('while the lift is serviced everyone takes the stairs: down, out, back up out of breath; the chat grumbles', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 960, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resting(page, 'at=22:00&liftservice');
  const id = await page.evaluate(() => {
    const o = (window as unknown as Win).__office!;
    const [id, worker] = [...o.workers.entries()][0];
    o.liftService.extend(300);
    worker.goHomeNow();
    return id;
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.liftService.stairs().down), { timeout: 120_000 }).toContain(id);
  await expect.poll(() => page.evaluate((id) => (window as unknown as Win).__office!.workers.get(id)?.station, id), { timeout: 90_000 }).toBe('away');
  expect(await page.evaluate((id) => {
    const o = (window as unknown as Win).__office!;
    o.speed(8);
    o.workers.get(id)!.comeBack();
    return o.liftService.stairs().up.includes(id);
  }, id)).toBe(true);
  await expect.poll(() => page.evaluate((id) => (window as unknown as Win).__office!.workers.get(id)?.station, id), { timeout: 120_000 }).toBe('desk');
  expect(await page.evaluate(() => (window as unknown as Win).__office!.chat.msgs.some((m) => /serviced|service|maintenance/i.test(m.text || '')))).toBe(true);
  expect(errors).toEqual([]);
});

test('on a phone: the lobby with the lift serviced', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:00&liftservice=new&lang=vi');
  await page.waitForFunction(() => (window as unknown as Win).__office?.liftService?.state().phase === 'work', null, { timeout: 60_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); o.view(-7.1, 1.2, 3.8, 6); });
  await page.waitForTimeout(2500);
  await shot(page, 'lift-phone.png');
  expect(errors).toEqual([]);
});
