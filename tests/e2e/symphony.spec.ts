import { expect, test } from '@playwright/test';

type SceneObject = {
  name: string;
  children: SceneObject[];
  geometry?: { type: string; parameters?: { options?: { depth?: number } } };
  material?: { color?: { getHexString: () => string } };
};

type Office = {
  speed: (n: number) => void;
  renderer: { render: (...args: unknown[]) => void };
  workers: Map<string, { station: string; anim: string; phase: string; pos: { x: number; y: number }; chore?: { thing?: string; spot: { x: number; z: number; node: string } }; bubbleEl: HTMLElement }>;
  sessions: Map<string, { name: string; symphonyMember: string; desk: number }>;
  nav: { DESK_SPOTS: { x: number; z: number }[] };
  scene: { getObjectByName: (name: string) => SceneObject | undefined };
};
type OfficeWindow = { __office: Office };

test('Assignments and blocker resolution follow worker movement in Signapse Office', async ({ page }) => {
  test.setTimeout(270_000);
  await page.setViewportSize({ width: 1150, height: 680 });
  await page.addInitScript(() => {
    localStorage.setItem('office-quality', 'low');
    localStorage.setItem('office-lite', 'on');
  });
  await page.goto('/?lang=vi&view=2d&debug');
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page).toHaveTitle('Signapse Office');
  await expect(page.locator('.tb-brand')).toContainText('Signapse Office');
  await expect.poll(() => page.evaluate(() => {
    const sign = (window as unknown as OfficeWindow).__office?.scene.getObjectByName('Signapse meeting room lettering');
    return sign?.children.map(({ name, geometry, material, children }) => ({
      name,
      depth: geometry?.parameters?.options?.depth,
      color: material?.color?.getHexString(),
      hasRaisedLogo: children.some((mesh) => mesh.geometry?.type === 'ExtrudeGeometry'),
    }));
  })).toEqual([
    { name: 'SIGNAPSE', depth: 0.055, color: '082d43', hasRaisedLogo: false },
    { name: 'MARKET INTELLIGENCE &', depth: 0.045, color: '007568', hasRaisedLogo: false },
    { name: 'TRADING AUTOMATION PLATFORM', depth: 0.045, color: '007568', hasRaisedLogo: false },
    { name: 'Signapse emblem', depth: undefined, color: undefined, hasRaisedLogo: true },
  ]);
  await expect(page.locator('#lite, #btn-lite, .tb-view')).toHaveCount(0);
  await expect(page.locator('.team-tag, [data-place="wc"], [data-place="director"], [data-place="lounge"]')).toHaveCount(0);
  await expect(page.locator('#demo-chip')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Khu báo vướng mắc' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phòng họp · Giao việc' })).toBeVisible();
  const rooms = await page.evaluate(() => {
    const { sessions, nav } = (window as unknown as OfficeWindow).__office;
    return [...sessions.values()].filter((s) => ['Sales', 'Marketing', 'Project Management'].includes(s.symphonyMember))
      .map((s) => ({ name: s.name, x: nav.DESK_SPOTS[s.desk].x, z: nav.DESK_SPOTS[s.desk].z }));
  });
  expect(rooms.filter((s) => s.name.startsWith('Sales Specialist') && s.x > 9 && s.z < -2)).toHaveLength(2);
  expect(rooms.filter((s) => s.name.startsWith('Marketing Specialist') && s.x > 9 && s.z > 4)).toHaveLength(2);
  expect(rooms.filter((s) => s.name.startsWith('Project Manager') && s.x < -3 && s.z < -3)).toHaveLength(2);
  await expect(page.locator('.tour, #btn-tips')).toHaveCount(0);
  for (const name of ['Runtime', 'Hàng đợi issue']) {
    const sidebar = page.getByRole('complementary', { name, exact: true });
    const toggle = page.getByRole('button', { name, exact: true }).and(page.locator('[data-sidebar]'));
    await expect(sidebar).toBeHidden();
    await toggle.press('Enter');
    await expect(sidebar).toBeVisible();
    await toggle.press('Enter');
    await expect(sidebar).toBeHidden();
    await toggle.press('Enter');
  }
  await page.evaluate(() => {
    const { renderer, speed, workers } = (window as unknown as OfficeWindow).__office;
    // Keep the walking and label updates running without software WebGL drawing every frame.
    renderer.render = () => {};
    speed(9);
    const observed = new Set<string>();
    const track = () => {
      const current = (id: string) => document.querySelector(`.symphony-queues [data-issue="${id}"]`)?.closest('section')?.dataset.queue;
      const first = current('OFC-201'), followup = current('OFC-207');
      const backend = workers.get('symphony-be-1'), frontend = workers.get('symphony-fe-1');
      if (first === 'assigned' && backend?.chore?.thing === 'symphony-meeting' && backend.phase === 'idle') observed.add('assigned in meeting');
      if (first === 'returning') observed.add('returning');
      if (first === 'active' && backend?.station === 'desk' && backend.anim === 'type') observed.add('started at desk');
      if (followup === 'blocked' && frontend?.anim !== 'type') observed.add('blocked');
      if (followup === 'unblocked') observed.add('unblocked');
      for (const w of workers.values()) {
        const spot = w.chore?.spot;
        if (!spot || w.phase !== 'idle' || Math.hypot(w.pos.x - spot.x, w.pos.y - spot.z) > 0.1) continue;
        if (w.chore?.thing === 'symphony-blockers' && spot.node === 'WCs' && w.bubbleEl.textContent?.includes('Mình nhận xử lý')) observed.add('owner acknowledgement');
      }
      document.body.dataset.observedRooms = [...observed].sort().join(', ');
      requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  });
  await page.getByRole('button', { name: 'Chạy lại' }).press('Enter');
  await expect(page.locator('body')).toHaveAttribute('data-observed-rooms',
    'assigned in meeting, blocked, owner acknowledgement, returning, started at desk, unblocked', { timeout: 150_000 });
});

test('Symphony starts with twelve members and shows planning and bug workflows', async ({ page }) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  const network: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || /^(?:\/api\/|\/stream$)/.test(url.pathname)) {
      network.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('office-quality', 'low');
    localStorage.setItem('office-wx', 'hn');
  });
  const start = new Date('2026-11-13T08:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 30_000));
  await page.goto('/?demo&lang=vi&layout=cozy&debug');
  await page.clock.fastForward(1500);
  const left = page.getByRole('complementary', { name: 'Runtime', exact: true });
  const right = page.locator('#feed');
  await page.locator('[data-sidebar="sessions"]').press('Enter');
  await page.locator('[data-sidebar="activity"]').press('Enter');
  const count = (kind: string) => right.locator(`[data-queue="${kind}"] .symphony-count`);
  const task = (id: string) => right.locator(`.symphony-queues [data-issue="${id}"]`);
  const detail = page.getByRole('dialog');
  const closeIssue = async () => {
    await detail.getByRole('button', { name: 'Đóng' }).press('Enter');
    await expect(detail).toBeHidden();
  };
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(left).toContainText('6 nhóm · 12 thành viên');
  await expect(count('active')).toHaveText('12');
  await expect(count('waiting')).toHaveText('4');
  await expect(count('blocked')).toHaveText('0');
  await expect(right).not.toContainText(/\bdemo\b/i);
  await expect(left.getByText('Đang nhận việc', { exact: true })).toHaveCount(6);
  await expect(left.locator('.symphony-seat-count')).toHaveText(['2/2', '2/2', '2/2', '2/2', '2/2', '2/2']);
  for (const id of ['btn-mac', 'btn-plan', 'btn-chat']) await expect(page.locator('#' + id)).toBeHidden();
  const workerIds = () => page.evaluate(() => [...(window as unknown as OfficeWindow).__office.workers.keys()]);
  const initialWorkers = await workerIds();
  expect(initialWorkers).toHaveLength(12);
  const seats = await page.evaluate(() => [...(window as unknown as OfficeWindow).__office.sessions.values()]
    .map((s) => [s.name, s.desk]));
  expect(seats.map(([name]) => name)).toEqual(['Backend Developer 1', 'Backend Developer 2', 'Frontend Developer 1', 'Frontend Developer 2',
    'Quality Assurance Engineer 1', 'Quality Assurance Engineer 2', 'Project Manager 1', 'Project Manager 2',
    'Sales Specialist 1', 'Sales Specialist 2', 'Marketing Specialist 1', 'Marketing Specialist 2']);
  expect(new Set(seats.map(([, desk]) => desk)).size).toBe(12);
  const progress = right.locator('.symphony-progress');
  const current = detail.locator('[aria-current="step"]');
  await progress.getByRole('button', { name: /Tạo requirement/ }).press('Enter');
  await expect(current).toContainText('REQ-01');
  await page.clock.fastForward(10_000);
  await expect(current).toContainText('EPIC-01');
  await expect(progress).toContainText('Thu thập bằng chứng');
  await page.clock.fastForward(10_000);
  await expect(current).toContainText('STORY-01');
  await expect(progress).toContainText('Log bug OFC-209');
  await closeIssue();
  await task('OFC-209').press('Enter');
  await expect(detail).toContainText('Các bước tái hiện');
  await expect(detail).toContainText('Mong đợi');
  await expect(detail).toContainText('Được ghi từ lượt kiểm thử OFC-210');
  await closeIssue();
  await task('OFC-207').press('Enter');
  await expect(detail).toContainText('Phụ thuộc OFC-212');
  await expect(detail).toContainText('Đã gỡ chặn');
  await closeIssue();
  await task('OFC-203').press('Enter');
  await expect(count('retrying')).toHaveText('1');
  await expect(detail).toContainText('Phiên Codex bị gián đoạn khi chạy test.');
  await expect(detail).toContainText('Thử lại lúc');
  await page.clock.fastForward(10_000);
  await expect(detail).toContainText('Lượt Codex thứ 2');
  await expect(progress).toContainText('Phân rã subtask');
  await expect(count('blocked')).toHaveText('0');
  await closeIssue();
  await page.getByRole('button', { name: 'Phòng họp · Giao việc' }).press('Enter');
  await expect(page.locator('#plc-sub')).toHaveText('MARKET INTELLIGENCE & TRADING AUTOMATION PLATFORM');
  await expect(page.locator('#plc-body')).toContainText('OFC-207 · Đăng ghi chú phát hành');
  await expect(page.locator('#plc-body')).toContainText('Project Manager 1 → Frontend Developer 2');
  await page.locator('#plc-close').press('Enter');
  await page.getByRole('button', { name: 'Khu báo vướng mắc' }).press('Enter');
  await expect(page.locator('#plc-body')).toContainText('Owner đã xác nhận phạm vi');
  await page.locator('#plc-close').press('Enter');
  await task('OFC-203').press('Enter');
  await page.clock.fastForward(10_000);
  await expect(progress).toContainText('Kiểm thử lại bản sửa');
  await page.clock.fastForward(10_000);
  await expect(count('active')).toHaveText('0');
  await expect(count('completed')).toHaveText('17');
  await expect(progress).toContainText('Xác nhận đã sửa lỗi');
  expect(await workerIds()).toEqual(initialWorkers);
  await expect(detail.getByRole('heading', { name: 'Tiêu chí nghiệm thu' })).toBeVisible();
  await expect(detail.getByRole('listitem')).toHaveCount(10);
  await expect(detail.getByRole('listitem').last()).toContainText('Hoàn thành');
  await page.keyboard.press('Escape');
  await expect(task('OFC-203')).toBeFocused();
  await page.clock.fastForward(12_000);
  await expect(count('active')).toHaveText('12');
  expect(await workerIds()).toEqual(initialWorkers);
  await page.getByRole('button', { name: 'Về ảnh chụp' }).press('Enter');
  await page.clock.fastForward(55_000);
  await expect(count('handoff')).toHaveText('1');
  await expect(count('retrying')).toHaveText('2');
  await expect(count('completed')).toHaveText('0');
  expect(await workerIds()).toEqual(initialWorkers);
  await task('OFC-210').press('Enter');
  await expect(detail).toContainText('Lần thử lại 15');
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
