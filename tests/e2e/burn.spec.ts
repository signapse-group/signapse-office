import { test, expect, type Page } from '@playwright/test';

// What eats your plan (server/otel.mjs, ui/burn.js): the office's OpenTelemetry receiver fed the way Claude Code feeds it
// (the OTLP/HTTP JSON fixtures of tests/fixtures/otel, moved to now), then the panel, the plan card's line, the chat's
// way in on a phone, and what the receiver refuses. In order: the empty state first, before anything is sent.
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|WebGL/i.test(m.text())) errors.push(m.text()); });
  return errors;
}
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { try { localStorage.setItem('office-quality', 'low'); } catch { /* private mode */ } }); });

test('the demo shows the panel with made-up numbers that add up', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?demo=claude&layout=cozy&burn=7d');
  const body = page.locator('#burn-body');
  await expect(body.locator('.bn-total')).toBeVisible({ timeout: 60_000 });
  await expect(body.locator('.bn-days .bn-day')).toHaveCount(7);
  await expect(body.locator('.bn-rank li').first()).toContainText('github');
  await expect(body.locator('.bn-plan')).toHaveText('≈ 46% of your weekly limit');
  await body.locator('.bn-week').scrollIntoViewIfNeeded();
  await page.locator('#dr-burn').screenshot({ path: test.info().outputPath('burn-demo-week.png') });
  expect(errors).toEqual([]);
});
