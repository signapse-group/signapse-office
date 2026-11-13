import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const port = process.env.SMOKE_PORT || '4397';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: { ...process.env, OFFICE_HOST: '127.0.0.1', OFFICE_PORT: port, OFFICE_LANG: 'en', NODE_ENV: 'production' },
  stdio: 'inherit',
});
const exited = once(server, 'exit');

try {
  let ready = false;
  for (let i = 0; i < 60 && server.exitCode === null; i++) {
    ready = await fetch(`${base}/health`).then((r) => r.ok, () => false);
    if (ready) break;
    await setTimeout(500);
  }
  assert.ok(ready, 'Office server did not start');
  const page = await fetch(`${base}/?lang=vi`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html lang="vi"/);

  for (const path of ['/stream', '/api/live', '/api/sys', '/api/log', '/api/panel', '/panel']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  for (const path of ['/event', '/api/tasks', '/hook/perm', '/v1/metrics']) {
    assert.equal((await fetch(base + path, { method: 'POST', body: '{}' })).status, 404, path);
  }
  console.log('Office renders in Vietnamese. The former live endpoints are gone.');
} finally {
  if (server.exitCode === null) server.kill();
  await exited;
}
