import { test, expect, type Page } from '@playwright/test';

// "Việc bỏ quên" (forgotten work) in the Mac panel, on real git repositories made in the test's own home folder: an
// "origin" and a clone whose worktrees hold work in different ways, one with nothing left in it.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebGL/i.test(m.text())) errors.push(m.text()); });
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } });
});

test('forgotten work in the demo: fictional folders, nothing touched', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&lang=en');
  await expect(async () => { if (!(await page.locator('#dr-mac').isVisible())) await page.click('#btn-mac'); await expect(page.locator('#dr-mac')).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 120_000 });
  const sec = page.locator('#mac-stranded');
  await expect(sec.locator('.st-row')).toHaveCount(3, { timeout: 30_000 });
  await expect(sec.locator('.st-del')).toHaveCount(1);
  await sec.locator('.st-del').click();
  await expect(sec.locator('.st-form--del')).toContainText('node_modules/, .next/');
  await sec.scrollIntoViewIfNeeded();
  await sec.screenshot({ path: test.info().outputPath('stranded-demo.png') });
  await sec.locator('.st-yes').click();
  await expect(page.locator('#toast')).toContainText('Demo');
  await expect(sec.locator('.st-row')).toHaveCount(3);
  expect(errors).toEqual([]);
});
