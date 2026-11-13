// Pack a fresh production build and remove machine-specific paths from the build metadata.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', OFFICE_DIST_DIR: '', OFFICE_STATIC: '' } });
for (const f of ['required-server-files.json', 'required-server-files.js']) {
  const p = path.join(ROOT, '.next', f);
  try { fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split(ROOT).join('.')); } catch { /* not written by this version */ }
}
