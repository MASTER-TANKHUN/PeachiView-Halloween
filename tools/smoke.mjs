// Smoke test: serve the repo, open a page in headless Chromium, report console errors, save a screenshot.
// Usage: node tools/smoke.mjs [page=index.html] [out=/tmp/shot.png] [waitMs=3000] [clickSelector]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(join(process.execPath, '../../lib/node_modules/playwright')); }

const [page = 'index.html', out = '/tmp/shot.png', waitMs = '3000', clickSel] = process.argv.slice(2);
const root = resolve(new URL('..', import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]));
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
const port = server.address().port;

const browser = await playwright.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// Offline CDN: if three is installed locally (npm i --no-save three@0.170.0), serve jsdelivr requests from node_modules.
const localThree = join(root, 'node_modules/three');
await tab.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\//, async (route) => {
  const rel = new URL(route.request().url()).pathname.replace(/^\/npm\/three@[^/]+\//, '');
  try { await route.fulfill({ body: await readFile(join(localThree, rel)), contentType: 'text/javascript' }); }
  catch { await route.continue(); }
});
const errors = [];
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
tab.on('pageerror', (e) => errors.push(String(e)));
await tab.goto(`http://localhost:${port}/${page}`);
await tab.waitForTimeout(1000);
if (clickSel) { await tab.click(clickSel).catch((e) => errors.push('click failed: ' + e.message)); }
await tab.waitForTimeout(Number(waitMs));
await tab.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'OK: no console errors');
console.log('screenshot:', out);
await browser.close();
server.close();
