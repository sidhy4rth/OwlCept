// Interface strings for the banner and popup. Warning text itself comes from
// the engine's explain(); these are the buttons and labels around it.

import type { Lang } from '@owlcept/engine';

export interface UiStrings {
  close: string;
  ask: string;
  dismiss: string;
  copyAnyway: string;
  typeToConfirm: string;
  confirmCopy: string;
  copied: string;
  careful: string;
  askMessage: string;
  blockedLine: string;
}

export const UI: Record<Lang, UiStrings> = {
  en: {
    close: 'Close this page',
    ask: 'Ask someone I trust',
    dismiss: 'Dismiss',
    copyAnyway: 'Copy anyway',
    typeToConfirm: 'Type COPY to confirm',
    confirmCopy: 'Copy',
    copied: 'Copied. Be careful where you paste it.',
    careful: 'OwlCept: check before you run this',
    askMessage: 'OwlCept stopped a suspicious command on my computer. It came from {host}. {detail} Can you help me check?',
    blockedLine: '# OwlCept blocked a hidden command from {host}. Do not run anything this page tells you to.',
  },
  hi: {
    close: 'यह पेज बंद करें',
    ask: 'किसी भरोसेमंद से पूछें',
    dismiss: 'हटाएँ',
    copyAnyway: 'फिर भी कॉपी करें',
    typeToConfirm: 'पुष्टि के लिए COPY लिखें',
    confirmCopy: 'कॉपी करें',
    copied: 'कॉपी हो गया। ध्यान से पेस्ट करें।',
    careful: 'OwlCept: चलाने से पहले जाँच लें',
    askMessage: 'OwlCept ने मेरे कंप्यूटर पर एक संदिग्ध कमांड रोका। यह {host} से आया था। {detail} क्या आप जाँचने में मेरी मदद कर सकते हैं?',
    blockedLine: '# OwlCept blocked a hidden command from {host}. Do not run anything this page tells you to.',
  },
  kn: {
    close: 'ಈ ಪುಟವನ್ನು ಮುಚ್ಚಿ',
    ask: 'ನಂಬಿಕಸ್ಥರನ್ನು ಕೇಳಿ',
    dismiss: 'ಸರಿ',
    copyAnyway: 'ಆದರೂ ನಕಲಿಸಿ',
    typeToConfirm: 'ಖಚಿತಪಡಿಸಲು COPY ಎಂದು ಟೈಪ್ ಮಾಡಿ',
    confirmCopy: 'ನಕಲಿಸಿ',
    copied: 'ನಕಲಿಸಲಾಗಿದೆ. ಎಲ್ಲಿ ಅಂಟಿಸುತ್ತೀರಿ ಎಂದು ಎಚ್ಚರವಹಿಸಿ.',
    careful: 'OwlCept: ಚಲಾಯಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ',
    askMessage: 'OwlCept ನನ್ನ ಕಂಪ್ಯೂಟರ್‌ನಲ್ಲಿ ಒಂದು ಸಂಶಯಾಸ್ಪದ ಕಮಾಂಡ್ ಅನ್ನು ತಡೆಹಿಡಿಯಿತು. ಇದು {host} ನಿಂದ ಬಂದಿತ್ತು. {detail} ಪರಿಶೀಲಿಸಲು ನನಗೆ ಸಹಾಯ ಮಾಡುತ್ತೀರಾ?',
    blockedLine: '# OwlCept blocked a hidden command from {host}. Do not run anything this page tells you to.',
  },
};

export type LangSetting = Lang | 'auto';

export function resolveLang(setting: LangSetting | undefined, uiLanguage: string): Lang {
  if (setting && setting !== 'auto') return setting;
  const l = uiLanguage.toLowerCase();
  if (l.startsWith('hi')) return 'hi';
  if (l.startsWith('kn')) return 'kn';
  return 'en';
}

export function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => params[k] ?? '');
}
