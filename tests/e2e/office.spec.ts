import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

// Collects uncaught errors and console errors while the page runs.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebGL/i.test(m.text())) errors.push(m.text()); });
  return errors;
}


for (const layout of ['pro', 'cozy', 'hq']) {
  test(`the ${layout} office starts in demo mode without errors`, { tag: '@smoke' }, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(`/?demo=claude&debug&layout=${layout}`);
    await expect(page.locator('#stage canvas')).toBeVisible();
    await expect(page.locator('#demo-chip')).toBeVisible();
    await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 20_000 });
    const backdrop = await page.evaluate(() => {
      const office = (window as unknown as { __office: { scene: { getObjectByName: (name: string) => { children: unknown[] } | undefined }, street: { doors: () => { name: string }[] } } }).__office;
      return { city: !!office.scene.getObjectByName('city'), storefronts: office.street.doors().length };
    });
    expect(backdrop.city).toBe(true);
    expect(backdrop.storefronts).toBeGreaterThan(0);
    await expect(page.locator('.tour, #btn-tips')).toHaveCount(0);
    await page.waitForTimeout(3000);
    expect(errors).toEqual([]);
  });
}

test('panels open and close', async ({ page }) => {
  test.setTimeout(180_000);   // (a Mac rendering it in software takes ~100 s for all of it, before and after 1/11: not a regression)
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });   // (a software-rendered page is slow enough at full quality to time out)
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=pro');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 60_000 });   // (a busy machine takes ~17 s)
  await page.click('#btn-look');
  await expect(page.locator('#pop-look')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('#btn-mac');
  await expect(page.locator('#dr-mac')).toBeVisible();
  await page.click('#dr-mac [data-close]');
  await expect(page.locator('#dr-mac')).toBeHidden();
  await page.click('#tl-open');
  await expect(page.locator('#tl')).toBeVisible();
  await page.click('#tl-close');
  await expect(page.locator('#stage canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('each desktop sidebar gives its width to the office and remembers its state', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1200, height: 760 });
  await page.addInitScript(() => localStorage.setItem('office-quality', 'low'));
  await page.goto('/?demo=claude&layout=cozy');
  const stage = page.locator('#stage');
  const sessions = page.getByRole('button', { name: 'Sessions', exact: true });
  const activity = page.locator('[data-sidebar="activity"]');
  const canvas = stage.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await expect(sessions).toHaveAttribute('aria-expanded', 'true');
  const initialWidth = (await stage.boundingBox())!.width;

  await sessions.press('Enter');
  await expect(sessions).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#sessions-sidebar')).toBeHidden();
  await expect(page.locator('#feed')).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(initialWidth);

  await activity.click();
  await expect(activity).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#feed')).toBeHidden();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBe(1200);

  await page.reload();
  await expect(sessions).toHaveAttribute('aria-expanded', 'false');
  await expect(activity).toHaveAttribute('aria-expanded', 'false');
  await sessions.click();
  await activity.click();
  await expect(page.locator('#sessions-sidebar')).toBeVisible();
  await expect(page.locator('#feed')).toBeVisible();
  await expect.poll(async () => (await stage.boundingBox())!.width).toBe(initialWidth);
});

test('a session opens its drawer from the list', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=pro');
  const row = page.locator('#rail-list .ri').first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(page.locator('#dr-session')).toBeVisible();
  await page.click('#tab-subs');
  await page.click('#tab-act');
  await page.click('#dr-session [data-close]');
  await expect(page.locator('#dr-session')).toBeHidden();
  expect(errors).toEqual([]);
});

test('English by default, another language on request', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/?demo=claude&layout=cozy');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#btn-look')).toContainText('Settings');
  await page.goto('/?demo=claude&layout=cozy&lang=vi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.locator('#btn-look')).toContainText('Cài đặt');
});

test('the weekly recap draws its card', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=cozy');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 20_000 });
  await page.click('#wrap-open');
  await expect(page.locator('#wrap-modal')).toBeVisible();
  await expect(page.locator('#wrap-note')).not.toContainText('Adding up');
  // the card is drawn: its middle is not the empty canvas
  const painted = await page.evaluate(() => {
    const c = document.getElementById('wrap-canvas') as HTMLCanvasElement;
    return c.getContext('2d')!.getImageData(540, 800, 1, 1).data[3] > 0;
  });
  expect(painted).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#wrap-modal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('settings: four tabs, character portraits, graphics level', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=cozy');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 20_000 });
  await page.click('#btn-look');
  await expect(page.locator('#pop-look')).toBeVisible();
  await page.click('[data-st-tab="people"]');
  await expect(page.locator('#st-panel-people')).toBeVisible();
  await expect(page.locator('[data-portrait="toy"] canvas')).toBeVisible();   // drawn by the office's renderer
  await page.click('[data-st-tab="display"]');
  await page.click('[data-quality="low"]');
  await expect(page.locator('[data-quality="low"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-quality="auto"]');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pop-look')).toBeHidden();
  expect(errors).toEqual([]);
});

test('photo mode hides the panels and saves a PNG', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=cozy');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 20_000 });
  await page.click('#btn-photo');
  await expect(page.locator('#photo-bar')).toBeVisible();
  await expect(page.locator('.topbar')).toBeHidden();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#ph-shoot')]);
  expect(download.suggestedFilename()).toMatch(/^my-office-.*\.png$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.topbar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a vertical 15-second clip with its music: 1080 × 1920, a sound track', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&layout=cozy');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 20_000 });
  await page.click('#btn-photo');
  await page.click('[data-clip-shape="tall"]');
  await expect(page.locator('[data-clip-shape="tall"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#ph-music')).toHaveAttribute('aria-pressed', 'true');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), page.click('#ph-clip')]);
  expect(download.suggestedFilename()).toMatch(/^my-office-clip-.*-9x16\.(mp4|webm)$/);
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.includes('mp4a') || bytes.includes('A_OPUS')).toBe(true);   // (an AAC or Opus track: the music)
  const size = await page.evaluate(async (b64) => {
    const v = document.createElement('video'); v.muted = true; v.src = `data:video/${b64.startsWith('GkXf') ? 'webm' : 'mp4'};base64,${b64}`;
    await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = no; });
    return [v.videoWidth, v.videoHeight];
  }, bytes.toString('base64'));
  expect(size).toEqual([1080, 1920]);
  expect(errors).toEqual([]);
});

test('the group chat: people post, a poll, @ someone and they answer, a reply, recall, reactions, stickers, a reminder, the unread count', async ({ page }) => {
  test.setTimeout(420_000);   // (many steps, and a headless browser draws the office slowly)
  const errors = watchErrors(page);
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); if (!sessionStorage.getItem('e2e-chat')) { localStorage.removeItem('office-chat-demo'); sessionStorage.setItem('e2e-chat', '1'); } } catch { /* private mode */ } });   // (cleared once: not again on the reload below)
  await page.goto('/?demo=claude&debug&layout=pro');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 60_000 });
  type Eng = { poll: (from: string, q: string, o: string[]) => void, remind: (from: string, t: string, at: number, rep: string) => void };
  type Chat = { chat: { msgs: { kind: string, from: string, text: string }[] }, chatSay: (from: string, text: string, o?: object) => void, chatEngine: () => Eng,
    sessions: Map<string, { id: string, name: string, title?: string }>, pauseDemo: () => void };
  await page.waitForFunction(() => !!(window as unknown as { __office?: { chat?: unknown } }).__office?.chat);
  await page.evaluate(() => (window as unknown as { __office: Chat }).__office.pauseDemo());
  await page.click('#btn-chat');
  const zc = page.locator('#zchat');
  await expect(zc).toBeVisible();
  await expect(zc.locator('.zc-title b')).toHaveText('My Office team');
  await expect(zc.locator('.zc-sub')).toContainText('members');
  // a poll (pinned): you vote
  await page.evaluate(() => (window as unknown as { __office: Chat }).__office.chatEngine().poll('reception', 'Lunch?', ['Phở', 'Bún bò', 'Cơm tấm']));
  const poll = zc.locator('.zc-poll').last();
  await expect(poll).toBeVisible({ timeout: 15_000 });
  await expect(zc.locator('.zc-pin')).toBeVisible();
  await poll.locator('.zc-poll-o').nth(1).click();
  await expect(poll.locator('.zc-poll-o').nth(1)).toHaveClass(/is-mine/);
  // a reminder card: you're going
  await page.evaluate(() => (window as unknown as { __office: Chat }).__office.chatEngine().remind('hr', 'Stand-up', Date.now() + 3600e3, 'week'));
  const rem = zc.locator('.zc-remind').last();
  await expect(rem).toBeVisible({ timeout: 15_000 });
  await rem.locator('.zc-rm-b.is-yes').click();
  await expect(rem.locator('.zc-rm-b.is-yes')).toHaveClass(/is-on/);
  // @ someone: they answer with what they're doing, quoting you
  const name = await page.evaluate(() => { const s = [...(window as unknown as { __office: Chat }).__office.sessions.values()][0]; return s.title || s.name; });
  await zc.locator('.zc-in').fill(`@${name} how is it going?`);
  await zc.locator('.zc-in').press('Enter');
  await expect(zc.locator('.zc-row.is-mine').last()).toContainText('how is it going?');
  await expect(zc.locator('.zc-at').last()).toHaveText(`@${name}`);
  await expect(zc.locator('.zc-row:not(.is-mine) .zc-quote').last()).toContainText('how is it going?', { timeout: 15_000 });
  // a reaction and a reply on their bubble
  const bub = zc.locator('.zc-row:not(.is-mine) .zc-bub').last();
  await bub.hover();
  await bub.locator('.zc-pick-b', { hasText: '😆' }).click();
  await expect(bub.locator('.zc-rx')).toContainText('😆');
  await bub.hover();
  await bub.locator('.zc-tool').first().click();
  await expect(zc.locator('.zc-reply')).toBeVisible();
  await zc.locator('.zc-in').fill('thanks');
  await zc.locator('.zc-in').press('Enter');
  await expect(zc.locator('.zc-row.is-mine').last().locator('.zc-quote')).toBeVisible();
  // recall your own
  const mine = zc.locator('.zc-row.is-mine .zc-bub').last();
  await mine.hover();
  await mine.locator('.zc-tool').last().click();
  await expect(zc.locator('.zc-row.is-mine').last()).toContainText('unsent');
  // a sticker (the toolbar's first button), an emoji into the text (😊 by the input), a 👍 shown big
  await zc.locator('.zc-toolbar .zc-ib').first().click();
  await zc.locator('.zc-stk').first().click();
  await expect(zc.locator('.zc-row.is-mine .zc-sticker').last()).toBeVisible();
  await zc.locator('.zc-bar .zc-ib.zc-pc').click();
  await zc.locator('.zc-emo').first().click();
  await expect(zc.locator('.zc-in')).toHaveValue(/\S/);
  await zc.locator('.zc-in').fill('');
  await zc.locator('.zc-like-send').click();
  await expect(zc.locator('.zc-row.is-mine .zc-bigemo').last()).toHaveText('👍');
  // shut: a new message counts as unread, with a card by the button; open again: "New messages" where you stopped
  await page.click('#btn-chat');
  await expect(zc).toBeHidden();
  await page.evaluate(() => (window as unknown as { __office: Chat }).__office.chatSay('reception', 'Hello from reception', { now: true }));
  await expect(page.locator('#chat-badge')).toBeVisible();
  await expect(page.locator('#zc-peek')).toContainText('Hello from reception');
  await page.click('#btn-chat');
  await expect(zc.locator('.zc-newline')).toBeVisible();
  // kept on this device (the demo has no server): the conversation is there after a reload
  const said = 'Hello from reception';
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __office?: { chat?: unknown } }).__office?.chat);
  expect(await page.evaluate((t) => (window as unknown as { __office: Chat }).__office.chat.msgs.some((m) => m.text === t), said)).toBe(true);
  expect(errors).toEqual([]);
});

// The handful of debug hooks (?debug) the reaction tests read: who is doing what, and the floor lamps.
type Person = { station: string, phase: string, chore?: { thing?: unknown, gathering?: unknown }, deliver: () => void, reset: () => void, anim: string, goHomeNow: () => void,
  onBreak?: boolean, doze?: boolean, carry?: string };
type DebugOffice = { director: Person, workers: Map<string, Person>, floorLamps: { on: boolean }[], PROPS: Map<string, unknown>, activateProp: (p: unknown) => void,
  sessions: Map<string, object>, upsert: (s: object) => void, pauseDemo: () => void, speed: (n: number) => void,
  limitOut: (min: number) => void, napOn: boolean,
  parcel: () => boolean, clean: () => void, staff: { cleaner: { offstage: boolean }, courier: { offstage: boolean }, delivery: unknown, strips: unknown[] },
  standup: () => boolean, teatime: () => boolean,
  attendance?: () => { terminal: boolean, log: Record<string, { name: string, at: string, out: string | null, inferred: boolean }>, earliest: string, screen: string, tabs: string, pending: string[] },
  birthday?: () => boolean, party?: { banner: boolean, members: number, slices: number } | false,
  testRun: (ok?: boolean, i?: number) => string | false, commit: (i?: number) => string | false, push: (i?: number) => string | false, tests: Record<string, string>,
  post: { inBox: number, today: number, trip: boolean, postman: { offstage: boolean, carry?: string } | null } };
type Win = { __office?: DebugOffice };   // (written out in each evaluate: the page cannot see this file's functions)

test('switch off the director’s lamp after dark and the director switches it back on', async ({ page }) => {
  const errors = watchErrors(page);
  // people walk at the frame rate: a small window on low graphics keeps a software-rendered page quick enough
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=22:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.director, null, { timeout: 30_000 });   // (no side list this narrow)
  // keep the director at the desk (the demo keeps handing out work): no more deliveries, and back in his chair
  await page.evaluate(() => { const d = (window as unknown as Win).__office!.director; d.deliver = () => {}; d.reset(); });
  const lampOn = () => page.evaluate(() => (window as unknown as Win).__office!.floorLamps[0].on);
  expect(await lampOn()).toBe(true);
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.activateProp(o.PROPS.get('lamp0')); });
  expect(await lampOn()).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.director.chore?.thing != null)).toBe(true);
  // (a software-rendered page runs the office slowly: time for the walk there and back)
  await expect.poll(lampOn, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => { const d = (window as unknown as Win).__office!.director; return !d.chore && d.station === 'home'; }), { timeout: 30_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('the meeting bell calls people to the meeting table', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=cozy&at=15:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.PROPS.get('bell'), null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.activateProp(o.PROPS.get('bell')); });
  await expect.poll(() => page.evaluate(() => [...(window as unknown as Win).__office!.workers.values()].some((w) => w.chore?.gathering)), { timeout: 30_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('a test run: the session watches it at the test board, whose lamp ends green', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:30&lang=en');
  await page.waitForFunction(() => (window as unknown as Win).__office?.testRun, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(3); });
  const id = await page.evaluate(() => (window as unknown as Win).__office!.testRun(true, 0));
  expect(id).toBeTruthy();
  // amber while it runs, the character over at the board; green after
  expect(await page.evaluate((i) => (window as unknown as Win).__office!.tests[i as string], id)).toBe('run');
  await expect.poll(() => page.evaluate((i) => (window as unknown as Win).__office!.workers.get(i as string)?.station, id), { timeout: 30_000 }).toBe('tests');
  await expect.poll(() => page.evaluate((i) => (window as unknown as Win).__office!.tests[i as string], id), { timeout: 15_000 }).toBe('ok');
  await expect(page.locator('#feed').getByText(/tests pass/i).first()).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('a commit goes in the post box, and a push brings the postman to empty it', async ({ page }) => {
  test.setTimeout(180_000);   // (the letter's walk, then the postman up and down by the lift)
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:30&lang=en');
  await page.waitForFunction(() => (window as unknown as Win).__office?.commit, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(4); });
  const before = await page.evaluate(() => (window as unknown as Win).__office!.post.today);
  const id = await page.evaluate(() => (window as unknown as Win).__office!.commit(0));
  expect(id).toBeTruthy();
  expect(await page.evaluate(() => (window as unknown as Win).__office!.post.today)).toBe(before + 1);
  // down to the box with the letter, posted
  await expect.poll(() => page.evaluate((i) => (window as unknown as Win).__office!.workers.get(i as string)?.station, id), { timeout: 40_000 }).toBe('post');
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.post.inBox), { timeout: 20_000 }).toBeGreaterThan(0);
  // a push: the postman comes up, empties the box, and goes
  await page.evaluate(() => (window as unknown as Win).__office!.push(0));
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.post.postman?.offstage), { timeout: 60_000 }).toBe(false);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.post.inBox), { timeout: 60_000 }).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.post.trip), { timeout: 60_000 }).toBe(false);
  expect(errors).toEqual([]);
});

// the accountant, the director's rounds (people/accountant.js, rounds.js): their debug hooks
type Staffed = { __office?: { workers?: unknown, sessions: Map<string, object>, upsert: (s: object) => void, pauseDemo: () => void, speed: (n: number) => void,
  accountant?: { atDesk: boolean, x: number, job: string | null, warn: string }, report: () => boolean, budgetWarn: () => boolean,
  rounds: () => boolean, round: { stage: string } | null } };

test('the accountant takes the day’s cost report to the director and asks the top spender to go easy near the limit', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=17:20');
  await page.waitForFunction(() => (window as unknown as Staffed).__office?.accountant?.atDesk, null, { timeout: 45_000 });
  await page.evaluate(() => (window as unknown as Staffed).__office!.speed(3));   // (two walks across the floor: sped up, as the other trips)
  expect(await page.evaluate(() => (window as unknown as Staffed).__office!.report())).toBe(true);
  // over to the director's desk with the sheet, and back to her own
  await expect.poll(() => page.evaluate(() => (window as unknown as Staffed).__office!.accountant!.x), { timeout: 40_000 }).toBeLessThan(-3.8);
  await expect.poll(() => page.evaluate(() => { const a = (window as unknown as Staffed).__office!.accountant!; return a.atDesk && !a.job; }), { timeout: 60_000 }).toBe(true);
  expect(await page.evaluate(() => (window as unknown as Staffed).__office!.budgetWarn())).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as Staffed).__office!.accountant!.warn), { timeout: 60_000 }).toMatch(/token/i);
  expect(errors).toEqual([]);
});

test('the director’s rounds: out of the corner office, round the desks, and back', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:05');
  await page.waitForFunction(() => (window as unknown as Staffed).__office?.workers, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Staffed).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); });
  // (at 10:05 the 10:00 round may already be under way: that one will do)
  // (everyone done at once: each comes to report first, and reports come before a round)
  await expect.poll(() => page.evaluate(() => { const o = (window as unknown as Staffed).__office!; return !!o.round || o.rounds(); }), { timeout: 150_000 }).toBe(true);
  await page.evaluate(() => (window as unknown as Staffed).__office!.speed(3));
  await expect.poll(() => page.evaluate(() => (window as unknown as Staffed).__office!.round?.stage ?? 'over'), { timeout: 40_000 }).toBe('look');
  await expect.poll(() => page.evaluate(() => (window as unknown as Staffed).__office!.round), { timeout: 90_000 }).toBe(null);
  expect(errors).toEqual([]);
});

test('out of Claude: people go on a break until the limit resets, then the bell calls them back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.workers.size, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(6); });
  await page.evaluate(() => (window as unknown as Win).__office!.limitOut(0.5));   // the limit used up, back in half a minute
  const onBreak = () => page.evaluate(() => [...(window as unknown as Win).__office!.workers.values()].filter((w) => w.onBreak && w.station !== 'desk').length);
  await expect.poll(onBreak, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(onBreak, { timeout: 45_000 }).toBe(0);
  expect(errors).toEqual([]);
});

test('the attendance terminal: a new session clocks in by the lift, HR sees them to their desk and puts up their name', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=09:10&lang=en');
  await page.waitForFunction(() => (window as unknown as Win).__office?.attendance, null, { timeout: 30_000 });
  // those already at their desks have clocked in (each session's first sign of the day), so the plate has an earliest
  await expect.poll(() => page.evaluate(() => Object.keys((window as unknown as Win).__office!.attendance!().log).length), { timeout: 20_000 }).toBeGreaterThan(2);
  expect(await page.evaluate(() => (window as unknown as Win).__office!.attendance!().earliest)).not.toBe('-');
  // a new session: up in the lift, a finger on the terminal (its own entry, not inferred), then HR puts its name on the pod
  await page.evaluate(() => {
    const o = (window as unknown as Win).__office!, list = [...o.sessions.values()] as { desk: number }[], used = new Set(list.map((s) => s.desk));
    const desk = [...Array(12).keys()].find((d) => !used.has(d));
    o.upsert({ ...list[0], id: 'newbie', name: 'web-new', status: 'work', desk, dir: '~/code/web-new', git: { repo: 'web-new' }, subs: [], doneSubs: [], bg: [] });
    o.speed(4);   // (HR comes from the far corner of the floor)
  });
  await expect.poll(() => page.evaluate(() => { const e = (window as unknown as Win).__office!.attendance!().log.newbie; return !!e && !e.inferred; }), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.attendance!().tabs.split('|').includes('web-new')), { timeout: 60_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('the month’s birthdays: HR brings the cake, the banner goes up, everyone sings and gets a slice', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:20&lang=en');
  await page.waitForFunction(() => (window as unknown as Win).__office?.birthday, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(4); });
  // (once someone is free to come)
  await expect.poll(() => page.evaluate(() => { const o = (window as unknown as Win).__office!; return !!o.party || o.birthday!(); }), { timeout: 45_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => { const p = (window as unknown as Win).__office!.party; return !!p && p.banner; }), { timeout: 60_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => { const p = (window as unknown as Win).__office!.party; return p ? p.slices : 0; }), { timeout: 60_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the midday nap: half of those resting sleep head down on the desk', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=cozy&at=12:45');
  await page.waitForFunction(() => (window as unknown as Win).__office?.workers.size, null, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.napOn)).toBe(true);   // (from the first frame on)
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(6); });
  await expect.poll(() => page.evaluate(() => [...(window as unknown as Win).__office!.workers.values()].some((w) => w.doze)), { timeout: 45_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('a Shopee courier brings a parcel and the one it is for collects it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.workers.size, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(6); });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.parcel()), { timeout: 45_000 }).toBe(true);
  // up in the lift, onto the counter, called out, collected
  await expect.poll(() => page.evaluate(() => { const S = (window as unknown as Win).__office!.staff; return !S.delivery && S.courier.offstage; }), { timeout: 60_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('the evening cleaner mops the aisles (wet strips), then goes home', async ({ page }) => {
  test.setTimeout(180_000);   // (every aisle mopped: long on a busy machine)
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=cozy&at=15:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.staff, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.speed(6); o.clean(); });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.staff.strips.length), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.staff.cleaner.offstage), { timeout: 75_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('Monday 9:00 stand-up and Friday 16:00 tea in the pantry', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:00');
  await page.waitForFunction(() => (window as unknown as Win).__office?.workers.size, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as Win).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(6); });
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.standup()), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => [...(window as unknown as Win).__office!.workers.values()].some((w) => w.chore?.gathering)), { timeout: 30_000 }).toBe(true);
  // after the meeting, the tea: someone with a cup of milk tea at a pantry table
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__office!.teatime()), { timeout: 90_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => [...(window as unknown as Win).__office!.workers.values()].some((w) => w.carry === 'cup')), { timeout: 60_000 }).toBe(true);
  expect(errors).toEqual([]);
});

type Paper = { compactNow: (i?: number) => string | null, paperwork: () => { levels: number[], shredder: { fill: number } | null, carrying: string[] },
  pingpong: () => boolean, foos: { ready: boolean, over: boolean, score: number[], ball: number[], players: string[] } | null };
type WinP = { __office?: DebugOffice & Paper };

test('a compaction: the desk\'s stack of paper goes to the shredder and the desk starts again', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:40');
  await page.waitForFunction(() => !!(window as unknown as WinP).__office?.compactNow, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as WinP).__office!; o.pauseDemo(); o.speed(3); });
  const id = await page.evaluate(() => (window as unknown as WinP).__office!.compactNow(0));
  expect(id).toBeTruthy();
  const desk = await page.evaluate((id) => ((window as unknown as WinP).__office!.sessions.get(id!) as { desk: number }).desk, id);
  // up from the desk with the stack, fed into the shredder (its bin fills a little), back with next to nothing on the desk
  await expect.poll(() => page.evaluate((id) => (window as unknown as WinP).__office!.paperwork().carrying.includes(id!), id), { timeout: 60_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as WinP).__office!.paperwork().shredder!.fill), { timeout: 60_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate((d) => (window as unknown as WinP).__office!.paperwork().levels[d], desk), { timeout: 30_000 }).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('foosball: two who are resting play a game in the lounge, and work coming in ends it', async ({ page }) => {
  test.setTimeout(240_000);   // (everyone settling down to rest first, then the walk over: slow on a software-rendered page)
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:20');
  await page.waitForFunction(() => !!(window as unknown as WinP).__office?.pingpong, null, { timeout: 30_000 });
  await page.evaluate(() => { const o = (window as unknown as WinP).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(3); });
  await expect.poll(() => page.evaluate(() => (window as unknown as WinP).__office!.pingpong()), { timeout: 90_000 }).toBe(true);
  // both at the table, the ball moving
  await expect.poll(() => page.evaluate(() => (window as unknown as WinP).__office!.foos?.ready), { timeout: 90_000 }).toBe(true);
  const b0 = await page.evaluate(() => (window as unknown as WinP).__office!.foos!.ball.join());
  await expect.poll(() => page.evaluate(() => (window as unknown as WinP).__office!.foos?.ball.join()), { timeout: 10_000 }).not.toBe(b0);
  // work for one of them: the game stops and both go back
  await page.evaluate(() => { const o = (window as unknown as WinP).__office!, id = o.foos!.players[0], s = o.sessions.get(id) as object; o.upsert({ ...s, status: 'work' }); });
  await expect.poll(() => page.evaluate(() => (window as unknown as WinP).__office!.foos), { timeout: 60_000 }).toBe(null);
  expect(errors).toEqual([]);
});

// gaming.js adds its own hooks (?debug)
type Tv = { on: boolean, kind: string | null, stage: string | null, npc: boolean, time: number | null, players: string[], me: boolean };
type WinT = { __office?: DebugOffice & { tvGame: (k?: string) => boolean, tvPlay: () => void, tv: Tv, fp: { on: boolean } } };

test('the lounge TV: two people resting play a match on the sofa, and in first person you sit down and play', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:40');
  await page.waitForFunction(() => !!(window as unknown as WinT).__office?.tvGame, null, { timeout: 60_000 });
  await page.evaluate(() => { const o = (window as unknown as WinT).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(3); });
  const tv = () => page.evaluate(() => (window as unknown as WinT).__office!.tv);
  await expect.poll(() => page.evaluate(() => (window as unknown as WinT).__office!.tvGame('racing')), { timeout: 90_000 }).toBe(true);
  // both on the sofa, the TV on, the race running
  await expect.poll(async () => (await tv()).stage, { timeout: 120_000 }).toBe('play');
  expect((await tv()).on).toBe(true);
  const t0 = (await tv()).time;
  await expect.poll(async () => (await tv()).time, { timeout: 60_000 }).not.toBe(t0);   // (after the 3-2-1)
  // work for one of them: the game ends where it stands, both get up, the TV goes back to standby
  await page.evaluate(() => { const o = (window as unknown as WinT).__office!, id = o.tv.players[0], s = o.sessions.get(id) as object; o.upsert({ ...s, status: 'work' }); });
  await expect.poll(async () => (await tv()).on, { timeout: 90_000 }).toBe(false);
  // first person: E at the TV sits you down; pick a game, play, get up
  await page.click('#btn-fp');
  await page.evaluate(() => (window as unknown as WinT).__office!.tvPlay());
  await expect.poll(async () => (await tv()).stage, { timeout: 10_000 }).toBe('menu');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await tv()).stage, { timeout: 10_000 }).toBe('play');
  expect((await tv()).kind).toBe('racing');
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(800); await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await tv()).me, { timeout: 10_000 }).toBe(false);
  expect(await page.evaluate(() => (window as unknown as WinT).__office!.fp.on)).toBe(true);   // (Esc gets you up, it doesn't leave first person)
  expect(errors).toEqual([]);
});

// billiards.js and karaoke.js add their own hooks (?debug)
type Bil = { stage: string | null, npc: boolean, shots: number, players: string[], me: boolean };
type Ktv = { stage: string | null, npc: boolean, song: string | null, singers: string[], me: boolean, beat: number | null };
type WinB = { __office?: DebugOffice & { bilGame: () => boolean, bilPlay: () => void, bil: Bil, ktvSing: () => boolean, ktvPlay: () => void, ktv: Ktv, fp: { on: boolean } } };
const restAll = (page: Page) => page.evaluate(() => { const o = (window as unknown as WinB).__office!; o.pauseDemo(); for (const s of o.sessions.values()) o.upsert({ ...s, status: 'rest', bg: [], subs: [] }); o.speed(3); });

test('pool in the lounge: two people resting play a frame, and in first person you pick up a cue and shoot', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=10:40');
  await page.waitForFunction(() => !!(window as unknown as WinB).__office?.bilGame, null, { timeout: 60_000 });
  await restAll(page);
  const bil = () => page.evaluate(() => (window as unknown as WinB).__office!.bil);
  await expect.poll(() => page.evaluate(() => (window as unknown as WinB).__office!.bilGame()), { timeout: 90_000 }).toBe(true);
  // both come over with a cue; the break goes in (the white leaves the head spot)
  await expect.poll(async () => (await bil()).shots, { timeout: 150_000 }).toBeGreaterThan(0);
  // work for one of them: the frame ends where it stands, both put their cues back and go
  await page.evaluate(() => { const o = (window as unknown as WinB).__office!, id = o.bil.players[0], s = o.sessions.get(id) as object; o.upsert({ ...s, status: 'work' }); });
  await expect.poll(async () => (await bil()).stage, { timeout: 90_000 }).toBe(null);
  // first person: E at the table picks up a cue, a colleague comes over (or you play alone); hold Space, let go: a shot
  await page.click('#btn-fp');
  await page.evaluate(() => (window as unknown as WinB).__office!.bilPlay());
  await expect.poll(async () => (await bil()).stage, { timeout: 90_000 }).toBe('you');
  await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space');
  await expect.poll(async () => (await bil()).shots, { timeout: 10_000 }).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await bil()).me, { timeout: 10_000 }).toBe(false);
  expect(await page.evaluate(() => (window as unknown as WinB).__office!.fp.on)).toBe(true);   // (Esc puts the cue back, it doesn't leave first person)
  expect(errors).toEqual([]);
});

test('karaoke: someone resting goes into the box and sings, and in first person you sing a song', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 800, height: 500 });
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  await page.goto('/?demo=claude&debug&layout=pro&at=15:10');
  await page.waitForFunction(() => !!(window as unknown as WinB).__office?.ktvSing, null, { timeout: 60_000 });
  await restAll(page);
  const ktv = () => page.evaluate(() => (window as unknown as WinB).__office!.ktv);
  await expect.poll(() => page.evaluate(() => (window as unknown as WinB).__office!.ktvSing()), { timeout: 90_000 }).toBe(true);
  // in through the door, a mic each, the song running (the words move on)
  await expect.poll(async () => (await ktv()).stage, { timeout: 150_000 }).toBe('sing');
  const b0 = (await ktv()).beat || 0;
  await expect.poll(async () => (await ktv()).beat || 0, { timeout: 30_000 }).toBeGreaterThan(b0 + 2);
  // work for the singer: the song stops and they come out
  await page.evaluate(() => { const o = (window as unknown as WinB).__office!, id = o.ktv.singers[0], s = o.sessions.get(id) as object; o.upsert({ ...s, status: 'work' }); });
  await expect.poll(async () => (await ktv()).stage, { timeout: 90_000 }).toBe(null);
  // first person: E at the box takes you in; pick the second song, sing, Esc takes you out
  await page.click('#btn-fp');
  await page.evaluate(() => (window as unknown as WinB).__office!.ktvPlay());
  await expect.poll(async () => (await ktv()).stage, { timeout: 10_000 }).toBe('menu');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await ktv()).stage, { timeout: 10_000 }).toBe('sing');
  expect((await ktv()).song).toBe('monday');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await ktv()).me, { timeout: 10_000 }).toBe(false);
  expect(await page.evaluate(() => (window as unknown as WinB).__office!.fp.on)).toBe(true);
  expect(errors).toEqual([]);
});

test('the machine drawer says why it is slow, closes idle sessions in one go and can do it on a timer', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=pro');
  await expect(page.locator('#rail-list .ri').first()).toBeVisible({ timeout: 60_000 });   // (17 s on a Mac deep in swap)
  await page.locator('#btn-mac').evaluate((b: HTMLElement) => b.click());
  const body = page.locator('#mac-body');
  await expect(body.locator('.verdict')).toHaveAttribute('data-level', 'warn');
  await expect(body.locator('.verdict .mspark')).toHaveCount(2);                   // (RAM and swap, each on its own chart)
  await expect(body.locator('.meters .meter')).toHaveCount(4);                      // (no plan reading in the demo)
  // who holds the RAM: one bar, a legend entry per segment, the editor's parts
  const segs = await body.locator('.held-bar i').count();
  expect(segs).toBeGreaterThan(2);
  await expect(body.locator('.held-legend li')).toHaveCount(segs);
  await expect(body.locator('.row--ide .ide-parts li').first()).toBeVisible();
  // the Claude sessions as you know them: the conversation's title, the app it runs in and since when, the one you are in
  const you = body.locator('.row--you');
  await expect(you).toHaveCount(1);
  await expect(you.locator('.row-name')).toContainText('New hero section and WebP images');
  await expect(you.locator('.row-badge--you')).toHaveText("you're talking here");
  await expect(you.locator('.row-sub').first()).toHaveText(/^Cursor · opened .*\d\d:\d\d · ~\/projects\/landing-page$/);
  await expect(body.locator('.row-name', { hasText: 'Cart pagination and shipping fees' })).toBeVisible();
  // the main action asks first, then (in the demo) does nothing on a real machine. Both clicks in one go: the drawer is
  // rebuilt every 5 seconds and the question goes away after 4.5, longer than a slow page takes between two steps.
  await expect(body.locator('.verdict-acts .btn--primary')).toBeVisible({ timeout: 10_000 });
  const asked = await body.evaluate((b) => {
    const seen: string[] = [], t = document.getElementById('toast')!;
    new MutationObserver(() => { if (!t.hidden) seen.push(t.textContent || ''); }).observe(t, { attributes: true, childList: true, subtree: true, characterData: true });
    (window as unknown as { seenToasts: string[] }).seenToasts = seen;
    (b.querySelector('.verdict-acts .btn--primary') as HTMLElement).click();
    const sure = b.querySelector('.verdict-acts .btn--confirm') as HTMLElement | null;
    sure?.click();
    return sure?.textContent || '';
  });
  expect(asked).toMatch(/\?/);
  await expect.poll(() => page.evaluate(() => (window as unknown as { seenToasts: string[] }).seenToasts.length)).toBeGreaterThan(0);
  const press = (sel: string) => body.locator(sel).first().evaluate((b: HTMLElement) => b.click());
  // closing idle sessions on a timer: off by default, one choice at a time
  const opts = body.locator('.auto-close [role="radio"]');
  await expect(opts).toHaveCount(4);
  await expect(opts.first()).toHaveAttribute('aria-checked', 'true');
  await press('.auto-close [role="radio"]:nth-child(2)');
  await expect(body.locator('.auto-close [role="radio"]').nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(body.locator('.auto-close [role="radio"]').first()).toHaveAttribute('aria-checked', 'false');
  expect(errors).toEqual([]);
});
