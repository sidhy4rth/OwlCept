import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOAuthPaste, detectLureText, detectOAuthCode, explainConsentFix, isRealCaptchaSource } from '../src/index.ts';

test('finds lure instructions in several languages', () => {
  const page = `Verify you are human. 1. Press Windows Key + R  2. Press CTRL + V  3. Press Enter`;
  assert.deepEqual(detectLureText(page), ['Win+R', 'Ctrl+V', 'press Enter', 'verify you are human']);
  assert.ok(detectLureText('⊞ + R').includes('Win+R'));
  assert.ok(detectLureText('Press Win + X then I to open Windows Terminal').includes('Win+X'));
  assert.ok(detectLureText('Open Terminal with ⌘ + Space and paste with ⌘+V').includes('Cmd+V'));
  assert.ok(detectLureText('Copy the path, open File Explorer and paste it in the address bar').includes('File Explorer address bar'));
  assert.ok(detectLureText('मैं रोबोट नहीं हूँ').includes('I am not a robot'));
  assert.ok(detectLureText('ನಾನು ರೋಬೋಟ್ ಅಲ್ಲ').includes('I am not a robot'));
  assert.ok(detectLureText('Je ne suis pas un robot').includes('I am not a robot'));
});

test('ordinary documentation does not look like a lure', () => {
  assert.deepEqual(detectLureText('Install the CLI with npm and run it from your project folder.'), []);
  assert.deepEqual(detectLureText('Use ctrl+c to stop the server.'), []);
});

test('recognises real CAPTCHA providers only', () => {
  assert.ok(isRealCaptchaSource('https://www.google.com/recaptcha/api2/anchor?k=x'));
  assert.ok(isRealCaptchaSource('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x'));
  assert.ok(isRealCaptchaSource('https://newassets.hcaptcha.com/captcha/v1/x'));
  assert.ok(!isRealCaptchaSource('https://example-lure.test/captcha.png'));
  assert.ok(!isRealCaptchaSource('https://cloudflare-verify.example-lure.test/'));
});

const MS_CALLBACK = `http://localhost:8400/?code=0.AXEA${'x'.repeat(120)}&state=abc123&session_state=s1`;

test('detects pasted OAuth redirect URLs and bare codes', () => {
  assert.deepEqual(detectOAuthCode(MS_CALLBACK), { provider: 'Microsoft', shape: 'redirect-url', redirectHost: 'localhost' });
  assert.equal(detectOAuthCode(`0.AXEA${'y'.repeat(150)}`)?.shape, 'raw-code');
  assert.equal(detectOAuthCode(`4/0AY${'z'.repeat(60)}`)?.provider, 'Google');
  assert.equal(detectOAuthCode('https://example.com/search?code=python&lang=en'), null);
  assert.equal(detectOAuthCode('just some text'), null);
});

test('blocks an OAuth code pasted into a site it was not issued for', () => {
  // ConsentFix: localhost callback pasted into the attacker's page, which itself started the sign-in.
  assert.equal(checkOAuthPaste(MS_CALLBACK, 'https://example-lure.test/connect').block, true);
  assert.equal(checkOAuthPaste(`0.AXEA${'y'.repeat(150)}`, 'https://example-lure.test/').block, true);
  // The app the code belongs to, a local dev server, and the identity provider itself are fine.
  const own = `https://app.example.dev/auth/callback?code=${'c'.repeat(40)}&state=x`;
  assert.equal(checkOAuthPaste(own, 'https://app.example.dev/settings').block, false);
  assert.equal(checkOAuthPaste(MS_CALLBACK, 'http://localhost:3000/').block, false);
  assert.equal(checkOAuthPaste(MS_CALLBACK, 'https://login.microsoftonline.com/common/oauth2').block, false);
  assert.equal(checkOAuthPaste('hello', 'https://example-lure.test/').block, false);
});

test('ConsentFix explanation names the provider in every language', () => {
  const code = detectOAuthCode(MS_CALLBACK)!;
  for (const lang of ['en', 'hi', 'kn'] as const) assert.match(explainConsentFix(code, lang).detail, /Microsoft/);
});

test('custody hash normaliser ignores line-ending and spacing differences', async () => {
  const { normalizeForHash } = await import('../src/index.ts');
  assert.equal(normalizeForHash('a  b\r\n  c \t'), normalizeForHash('a b\nc'));
  assert.notEqual(normalizeForHash('a b'), normalizeForHash('ab'));
});
