// Reads the lure signals around a copy: instructions such as "Win+R" near
// the click, and a CAPTCHA that no real CAPTCHA provider served.

import { detectLureText, isRealCaptchaSource } from '@owlcept/engine';
import { perceptible } from './visibility.ts';

const NEARBY_CHARS = 300;
const MAX_CLIMB = 8;
const CAPTCHA_WORDS = /captcha|not a robot|verify you are human|human verification|are you human|रोबोट|ರೋಬೋಟ್/i;

export interface LureContext {
  lureWords: string[];
  fakeCaptcha: boolean;
}

export function readLureContext(clicked: Element | null, doc: Document = document): LureContext {
  const texts: string[] = [];

  if (clicked) {
    let el: Element = clicked;
    for (let i = 0; i < MAX_CLIMB && el.parentElement && innerTextOf(el).length < NEARBY_CHARS; i++) el = el.parentElement;
    texts.push(innerTextOf(el).slice(0, 5000));
  } else {
    texts.push(innerTextOf(doc.body).slice(0, 8000));
  }

  // Lure prompts live in modals and full-screen overlays.
  for (const d of doc.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) {
    texts.push(innerTextOf(d).slice(0, 3000));
  }
  const win = doc.defaultView;
  if (win && doc.body) {
    for (const child of doc.body.children) {
      const pos = win.getComputedStyle(child).position;
      if ((pos === 'fixed' || pos === 'absolute') && perceptible(child)) texts.push(innerTextOf(child).slice(0, 3000));
    }
  }

  const combined = texts.join('\n');
  const lureWords = detectLureText(combined);
  const captchaShown = CAPTCHA_WORDS.test(combined);
  const realCaptcha = [...doc.querySelectorAll<HTMLIFrameElement | HTMLScriptElement>('iframe[src], script[src]')].some((e) =>
    isRealCaptchaSource(e.src),
  );
  return { lureWords, fakeCaptcha: captchaShown && !realCaptcha };
}

function innerTextOf(el: Element | null): string {
  return (el as HTMLElement | null)?.innerText ?? el?.textContent ?? '';
}
