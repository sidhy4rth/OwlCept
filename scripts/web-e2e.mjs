// Checks the built web pages in Chromium: OwlCept Check still renders, and the fleet
// view merges real exports, rejects files that are not exports, and makes no requests.
//   npm run build -w @owlcept/web && node scripts/web-e2e.mjs [--shots]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildReport, generateDeviceKey, signReport } from '../packages/engine/src/index.ts';

const dist = new URL('../web/dist/', import.meta.url).pathname;
const shots = process.argv.includes('--shots') ? new URL('../docs/assets/', import.meta.url).pathname : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
const problems = [];
const outside = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(e.message));
page.on('request', (r) => !r.url().startsWith('https://owlcept.test/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && outside.push(r.url()));
await page.route('https://owlcept.test/**', (route) => {
  const path = new URL(route.request().url()).pathname.replace(/^\/$/, '/index.html');
  try {
    route.fulfill({ body: readFileSync(dist + path.slice(1)), contentType: types[extname(path)] ?? 'application/octet-stream' });
  } catch {
    route.fulfill({ status: 404, body: '' });
  }
});

await page.goto('https://owlcept.test/');
check('OwlCept Check loads', (await page.title()) === 'OwlCept Check');

// The step-by-step trace, on the brief's harmless marker wrapped in caret escapes and Base64.
const marker = Buffer.from('c^m^d /c e^c^h^o SIMULATED-CLICKFIX', 'utf16le').toString('base64');
await page.fill('textarea', `powershell -enc ${marker}`);
await page.waitForSelector('ol.steps li:nth-child(2)', { state: 'attached' });
await page.evaluate(() => { const d = document.querySelector('details.trace'); if (d) d.open = true; });
const steps = await page.locator('ol.steps > li').allTextContents();
check('trace: the decoded layer names its decoder and parent step', steps.length >= 2 && /decoded Base64/.test(steps[1]) && /from step 1/.test(steps[1]), steps.map((x) => x.slice(0, 40)).join(' | '));
check('trace: disguises inside a decoded layer are listed', /removed \^ escape marks/.test(steps.join(' ')));
if (shots) await page.locator('#result').screenshot({ path: `${shots}web-trace.png` });
await page.click('[data-lang="hi"]');
check('trace: step labels follow the page language', /Base64 डिकोड किया/.test(await page.textContent('ol.steps')));
await page.click('[data-lang="en"]');

await page.goto('https://owlcept.test/fleet.html');
await page.click('#sample');
await page.waitForSelector('#report:not([hidden])');
check('sample data renders three devices', (await page.locator('#devices tr').count()) === 3);
check('signatures: two sample devices verified, one not signed', (await page.locator('#devices td.sig.ok').count()) === 2 && (await page.locator('#devices td.sig.none').count()) === 1);
check('campaign across devices is found', (await page.locator('#campaigns tr').count()) >= 1 && (await page.textContent('#campaigns')).includes('[.]'));
check('audit near-misses are counted', /would have stopped 2 more/.test(await page.textContent('#audit-note')));
if (shots) await page.screenshot({ path: `${shots}web-fleet.png`, fullPage: true });

// Policy builder: tick the campaign's site, generate each format.
await page.locator('#hosts input[type=checkbox]').first().check();
await page.fill('#approved', `${'c'.repeat(64)}\nnot-a-fingerprint`);
const ps = await page.textContent('#policy-preview');
check('policy: PowerShell command names the ticked site', ps.startsWith(".\\Set-OwlCeptPolicy.ps1 -BlockedHosts 'verify-human.example-lure.test' -ApprovedCommands 'cccc"), ps.slice(0, 90));
check('policy: an invalid fingerprint is left out and reported', /Left out 1 value/.test(await page.textContent('#policy-note')));
await page.selectOption('#format', 'reg');
const [regDl] = await Promise.all([page.waitForEvent('download'), page.click('#policy-download')]);
const reg = readFileSync(await regDl.path(), 'utf8');
check('policy: .reg download covers Chrome and Edge', reg.startsWith('Windows Registry Editor Version 5.00') && reg.includes('Google\\Chrome') && reg.includes('Microsoft\\Edge') && regDl.suggestedFilename().endsWith('.reg'));
await page.selectOption('#format', 'json');
check('policy: JSON is valid browser policy', JSON.parse(await page.textContent('#policy-preview'))['3rdparty'].extensions.jjkhmdbenclipofjaeeblabpmjdcibpi.blockedHosts[0] === 'verify-human.example-lure.test');
if (shots) await page.locator('#policy').screenshot({ path: `${shots}web-fleet-policy.png` });

// Real exports through the file picker, plus one file that is not an export.
await page.click('#reset');
const dir = mkdtempSync(join(tmpdir(), 'owlcept-fleet-'));
const now = Date.now();
const ev = (host, h) => ({ time: now - 3_600_000, kind: 'copy-block', host, ids: ['download-exec'], hash: h.repeat(64) });
const files = [
  ['pc1.json', buildReport([ev('a.example-lure.test', 'a'), ev('b.example-lure.test', 'b')], { id: 'pc-1', label: 'PC 1' }, { name: 'OwlCept extension', version: '0.2.0' }, 'smart')],
  ['pc2.json', buildReport([ev('a.example-lure.test', 'a')], { id: 'pc-2', label: '<img src=x onerror=alert(1)>' }, { name: 'OwlCept extension', version: '0.2.0' }, 'strict')],
].map(([name, r]) => {
  writeFileSync(join(dir, name), JSON.stringify(r));
  return join(dir, name);
});
writeFileSync(join(dir, 'notes.json'), '{"hello": "world"}');
// Signed exports: one untouched, one edited after signing, one from the same device with a new key.
const pc3 = buildReport([ev('c.example-lure.test', 'c')], { id: 'pc-3', label: 'PC 3' }, { name: 'OwlCept extension', version: '0.3.0' }, 'smart');
const signed3 = await signReport(pc3, await generateDeviceKey());
const tampered = JSON.parse(JSON.stringify(signed3));
tampered.events = [];
writeFileSync(join(dir, 'pc3.json'), JSON.stringify(signed3));
writeFileSync(join(dir, 'pc3-edited.json'), JSON.stringify(tampered));
writeFileSync(join(dir, 'pc3-newkey.json'), JSON.stringify(await signReport({ ...pc3, exported: new Date(Date.now() + 1000).toISOString() }, await generateDeviceKey())));
await page.setInputFiles('#file', [...files, join(dir, 'notes.json'), join(dir, 'pc3.json'), join(dir, 'pc3-edited.json'), join(dir, 'pc3-newkey.json')]);
await page.waitForFunction(() => document.querySelectorAll('#files li').length === 6);
const fileNotes = await page.locator('#files li').allTextContents();
check('signatures: an edited export is rejected and left out', fileNotes.some((t) => t.startsWith('pc3-edited.json') && /contents changed after signing/.test(t)));
check('signatures: a device whose key changes is flagged', (await page.locator('#devices td.sig.bad').count()) === 1 && fileNotes.some((t) => /KEY CHANGED/.test(t)));
check('signatures: unsigned exports still count, marked as such', (await page.locator('#devices td.sig.none').count()) === 2);
check('exports merge into one row per device; the edited file adds nothing', (await page.locator('#devices tr').count()) === 3 && (await page.textContent('#n-blocked')) === '4');
check('a file that is not an export is rejected with a reason', (await page.textContent('#files li.err')).includes('not an OwlCept activity export'));
check('device labels render as text, not HTML', (await page.locator('#devices img').count()) === 0 && (await page.textContent('#devices')).includes('<img src=x'));
check('no console or CSP errors', problems.length === 0, problems.join(' | '));
check('no request leaves the page', outside.length === 0, outside.join(' '));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
