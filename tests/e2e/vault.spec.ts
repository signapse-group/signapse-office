import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } }); });

test('the online demo has a few made-up ones, from the chat\'s ••• too', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?demo=claude&layout=pro');
  await expect(async () => { if (!(await page.locator('#zchat').isVisible())) await page.click('#btn-chat'); await expect(page.locator('#zchat')).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 90_000 });
  await page.locator('#zchat .zc-toolbar [title="More"], #zchat .zc-bar .zc-mo[title="More"]').first().click();
  await page.locator('.zc-more-o', { hasText: 'History vault' }).click();
  const v = page.locator('#dr-vault');
  await expect(v.locator('.vl-row')).toHaveCount(3);
  await expect(v.locator('.vl-row.is-gone')).toHaveCount(1);
  await v.locator('.vl-row').first().click();
  await expect(v.locator('.vl-msg')).toHaveCount(2);
});

