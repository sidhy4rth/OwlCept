// ConsentFix guard. The victim signs in on a real identity page, then pastes
// the resulting redirect URL (which carries an OAuth authorisation code) into
// an attacker's page. No terminal is involved, so the browser must catch it.

import type { Lang } from './types.ts';

export interface OAuthCode {
  provider: string;
  /** 'redirect-url' for a pasted callback URL, 'raw-code' for a bare code. */
  shape: 'redirect-url' | 'raw-code';
}

const PROVIDERS: [RegExp, string][] = [
  [/login\.microsoftonline\.com|login\.live\.com|microsoft/i, 'Microsoft'],
  [/accounts\.google\.com|google/i, 'Google'],
  [/github\.com/i, 'GitHub'],
  [/appleid\.apple\.com/i, 'Apple'],
  [/okta\.com/i, 'Okta'],
];

export function detectOAuthCode(text: string): OAuthCode | null {
  const t = text.trim();
  for (const m of t.matchAll(/\b(?:https?:\/\/|ms-appx-web:\/\/|msauth[.\w]*:\/\/)[^\s'"<>]+/gi)) {
    let url: URL;
    try {
      url = new URL(m[0]);
    } catch {
      continue;
    }
    const params = new URLSearchParams(url.search + (url.hash ? `&${url.hash.slice(1)}` : ''));
    const code = params.get('code');
    if (!code || code.length < 10) continue;
    const looksLikeCallback =
      params.has('state') ||
      params.has('session_state') ||
      params.has('client_info') ||
      /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname) ||
      /nativeclient|oauth|callback|redirect|auth/i.test(url.pathname);
    if (!looksLikeCallback) continue;
    return { provider: providerOf(`${url.href} ${code}`), shape: 'redirect-url' };
  }
  // Bare Microsoft (0.A... / 1.A...) or Google (4/0A...) authorisation codes.
  if (/^[01]\.A[A-Za-z0-9_\-.]{100,}$/.test(t)) return { provider: 'Microsoft', shape: 'raw-code' };
  if (/^4\/0A[A-Za-z0-9_\-]{30,}$/.test(t)) return { provider: 'Google', shape: 'raw-code' };
  return null;
}

function providerOf(s: string): string {
  if (/[?&]code=[01]\.A/.test(s)) return 'Microsoft';
  if (/[?&]code=4\/0A/.test(s)) return 'Google';
  for (const [re, name] of PROVIDERS) if (re.test(s)) return name;
  return 'online';
}

export interface OAuthPasteDecision {
  block: boolean;
  code: OAuthCode | null;
}

/**
 * Decides a paste into a web page. Blocks when the text carries an OAuth code
 * and the page receiving it did not start a sign-in in this tab.
 */
export function checkOAuthPaste(text: string, pageUrl: string, pageStartedSignIn: boolean): OAuthPasteDecision {
  const code = detectOAuthCode(text);
  if (!code) return { block: false, code: null };
  let host = '';
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    /* unknown page, treat as unrelated */
  }
  const identityPage = /(?:^|\.)(?:microsoftonline\.com|live\.com|google\.com|github\.com|apple\.com|okta\.com)$/i.test(host);
  return { block: !pageStartedSignIn && !identityPage, code };
}

const CONSENTFIX_TEXT: Record<Lang, { headline: string; detail: string; advice: string }> = {
  en: {
    headline: 'Stopped: this site is trying to take over your account.',
    detail:
      'You pasted a sign-in link that contains a secret login code. Whoever has this code can get into your {provider} account, even if you use a passkey or two-step login. This website did not start that sign-in.',
    advice: 'Do not paste it. Close the page.',
  },
  hi: {
    headline: 'रोका गया: यह साइट आपके अकाउंट पर कब्ज़ा करने की कोशिश कर रही है।',
    detail:
      'आपने एक साइन-इन लिंक पेस्ट किया है जिसमें एक गुप्त लॉगिन कोड है। जिसके पास यह कोड होगा, वह आपके {provider} अकाउंट में घुस सकता है, चाहे आप पासकी या दो-चरण लॉगिन इस्तेमाल करें। इस वेबसाइट ने वह साइन-इन शुरू नहीं किया था।',
    advice: 'इसे पेस्ट न करें। पेज बंद कर दें।',
  },
  kn: {
    headline: 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ: ಈ ಸೈಟ್ ನಿಮ್ಮ ಖಾತೆಯನ್ನು ವಶಪಡಿಸಿಕೊಳ್ಳಲು ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ.',
    detail:
      'ನೀವು ರಹಸ್ಯ ಲಾಗಿನ್ ಕೋಡ್ ಇರುವ ಸೈನ್-ಇನ್ ಲಿಂಕ್ ಅನ್ನು ಅಂಟಿಸಿದ್ದೀರಿ. ಈ ಕೋಡ್ ಯಾರ ಬಳಿ ಇರುತ್ತದೋ ಅವರು ನಿಮ್ಮ {provider} ಖಾತೆಗೆ ಪ್ರವೇಶಿಸಬಹುದು, ನೀವು ಪಾಸ್‌ಕೀ ಅಥವಾ ಎರಡು-ಹಂತದ ಲಾಗಿನ್ ಬಳಸಿದರೂ ಸಹ. ಈ ವೆಬ್‌ಸೈಟ್ ಆ ಸೈನ್-ಇನ್ ಅನ್ನು ಆರಂಭಿಸಿಲ್ಲ.',
    advice: 'ಇದನ್ನು ಅಂಟಿಸಬೇಡಿ. ಪುಟವನ್ನು ಮುಚ್ಚಿ.',
  },
};

export function explainConsentFix(code: OAuthCode, lang: Lang = 'en'): { headline: string; detail: string; advice: string } {
  const t = CONSENTFIX_TEXT[lang];
  return { headline: t.headline, detail: t.detail.replace('{provider}', code.provider), advice: t.advice };
}
