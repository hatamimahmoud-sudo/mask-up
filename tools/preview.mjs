// Render every mask over the reference face in index.html, as PNGs you can look at.
// The masks are landmark-driven, so this is the only way to check their geometry
// without pointing a camera at yourself.
//
//   npm i -D playwright && node tools/preview.mjs
//
// Writes tools/preview/<mask id>.png. CHROME=/path/to/chrome overrides the browser.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tools', 'preview');
const W = 900, H = 1200;

// Everything above the State section is pure drawing code: landmark sets, geom(),
// MASKS and the reference face. Lift it out and run it against a bare canvas.
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const core = src.split('// ---------- State ----------')[0].replace(/^import .*$/m, '');

const page = `<!doctype html><meta charset="utf-8"><canvas id="c" width="${W}" height="${H}"></canvas>
<script type="module">
${core}
window.__ids = MASKS.map(m => m.id);
window.__render = id => {
  const c = document.getElementById('c'), ctx = c.getContext('2d');
  ctx.fillStyle = '#0E0C12'; ctx.fillRect(0, 0, ${W}, ${H});
  const g = geom(REF, ${W}, ${H});
  refFace(ctx, g);
  MASKS.find(m => m.id === id).draw(ctx, g);
  return c.toDataURL('image/png');
};
window.__ready = true;
<\/script>`;

fs.mkdirSync(outDir, { recursive: true });
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const tab = await browser.newPage({ viewport: { width: W, height: H } });
tab.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
await tab.goto(url);
await tab.waitForFunction('window.__ready === true', null, { timeout: 15000 });

for (const id of await tab.evaluate(() => window.__ids)) {
  const data = await tab.evaluate(id => window.__render(id), id);
  fs.writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('tools/preview/' + id + '.png');
}

await browser.close();
server.close();
