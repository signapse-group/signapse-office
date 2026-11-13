import { createServer } from 'node:http';
import next from 'next';
import { pickLang } from '../src/i18n/index.js';

const dev = process.argv.includes('--dev');
const hostname = process.env.OFFICE_HOST || '127.0.0.1';
const port = Number(process.env.OFFICE_PORT) || 4310;
process.env.NODE_ENV ||= dev ? 'development' : 'production';

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  req.headers['x-office-lang'] = pickLang(url.searchParams.get('lang') || process.env.OFFICE_LANG);
  handle(req, res);
});
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler();
await app.prepare();
server.listen(port, hostname, () => console.log(`[office] http://${hostname}:${port}`));
