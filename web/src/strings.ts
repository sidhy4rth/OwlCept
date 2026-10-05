// Page labels. The verdict sentences themselves come from the engine.
// Hindi and Kannada should be reviewed by native speakers before release.

import type { Lang } from '@owlcept/engine';

export interface PageStrings {
  title: string;
  tagline: string;
  label: string;
  placeholder: string;
  where: string;
  t_unknown: string;
  t_run: string;
  t_terminal: string;
  t_explorer: string;
  lure: string;
  examples: string;
  ex_installer: string;
  ex_suspicious: string;
  ex_signin: string;
  empty: string;
  nothing: string;
  safeNote: string;
  risk: string;
  contacts: string;
  howRead: string;
  pasted: string;
  fromStep: string;
  privacy: string;
  privacyApp: string;
}

export const STRINGS: Record<Lang, PageStrings> = {
  en: {
    title: 'OwlCept Check',
    tagline: 'Someone asked you to paste and run a command? Check it here first.',
    label: 'Paste the command',
    placeholder: 'Paste it here. Nothing leaves your device.',
    where: 'Where were you told to run it?',
    t_unknown: 'Not sure',
    t_run: 'Run box (Windows key + R)',
    t_terminal: 'Terminal or PowerShell',
    t_explorer: 'File Explorer address bar',
    lure: 'A website or a person told me to press keys like Win+R or Ctrl+V to "verify" or "fix" something',
    examples: 'Try an example:',
    ex_installer: 'Official installer',
    ex_suspicious: 'Suspicious command',
    ex_signin: 'Sign-in code',
    empty: 'Paste a command above to see what it would do.',
    nothing: 'Nothing risky found.',
    safeNote: 'Still, only run commands from people and sites you trust.',
    risk: 'Risk',
    contacts: 'Websites it contacts',
    howRead: 'How OwlCept read it, step by step',
    pasted: 'What you pasted',
    fromStep: 'from step {n}',
    privacy: 'Runs entirely in your browser. Nothing you paste is uploaded: this page is not allowed to connect to the internet.',
    privacyApp: 'Runs entirely on your phone. Nothing you check is uploaded: this app has no permission to use the internet.',
  },
  hi: {
    title: 'OwlCept जाँच',
    tagline: 'किसी ने आपसे कोई कमांड पेस्ट करके चलाने को कहा? पहले यहाँ जाँचें।',
    label: 'कमांड पेस्ट करें',
    placeholder: 'यहाँ पेस्ट करें। कुछ भी आपके डिवाइस से बाहर नहीं जाता।',
    where: 'आपसे इसे कहाँ चलाने को कहा गया?',
    t_unknown: 'पता नहीं',
    t_run: 'Run बॉक्स (Windows की + R)',
    t_terminal: 'Terminal या PowerShell',
    t_explorer: 'File Explorer का पता बार',
    lure: 'किसी वेबसाइट या व्यक्ति ने "सत्यापन" या "ठीक करने" के लिए Win+R या Ctrl+V जैसी कुंजियाँ दबाने को कहा',
    examples: 'उदाहरण आज़माएँ:',
    ex_installer: 'आधिकारिक इंस्टॉलर',
    ex_suspicious: 'संदिग्ध कमांड',
    ex_signin: 'साइन-इन कोड',
    empty: 'ऊपर कोई कमांड पेस्ट करें और देखें कि यह क्या करेगा।',
    nothing: 'कुछ भी जोखिम भरा नहीं मिला।',
    safeNote: 'फिर भी, केवल भरोसेमंद लोगों और साइटों के कमांड ही चलाएँ।',
    risk: 'जोखिम',
    contacts: 'यह किन वेबसाइटों से जुड़ता है',
    howRead: 'OwlCept ने इसे कैसे पढ़ा, क़दम-दर-क़दम',
    pasted: 'आपने जो पेस्ट किया',
    fromStep: 'क़दम {n} से',
    privacy: 'यह पूरी तरह आपके ब्राउज़र में चलता है। आप जो पेस्ट करते हैं वह कहीं अपलोड नहीं होता: इस पेज को इंटरनेट से जुड़ने की अनुमति ही नहीं है।',
    privacyApp: 'यह पूरी तरह आपके फ़ोन पर चलता है। आप जो जाँचते हैं वह कहीं अपलोड नहीं होता: इस ऐप को इंटरनेट इस्तेमाल करने की अनुमति ही नहीं है।',
  },
  kn: {
    title: 'OwlCept ಪರಿಶೀಲನೆ',
    tagline: 'ಯಾರಾದರೂ ಒಂದು ಕಮಾಂಡ್ ಅಂಟಿಸಿ ಚಲಾಯಿಸಲು ಹೇಳಿದರೆ? ಮೊದಲು ಇಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.',
    label: 'ಕಮಾಂಡ್ ಅಂಟಿಸಿ',
    placeholder: 'ಇಲ್ಲಿ ಅಂಟಿಸಿ. ಏನೂ ನಿಮ್ಮ ಸಾಧನದಿಂದ ಹೊರಗೆ ಹೋಗುವುದಿಲ್ಲ.',
    where: 'ಇದನ್ನು ಎಲ್ಲಿ ಚಲಾಯಿಸಲು ಹೇಳಲಾಯಿತು?',
    t_unknown: 'ಗೊತ್ತಿಲ್ಲ',
    t_run: 'Run ಬಾಕ್ಸ್ (Windows ಕೀ + R)',
    t_terminal: 'Terminal ಅಥವಾ PowerShell',
    t_explorer: 'File Explorer ವಿಳಾಸ ಪಟ್ಟಿ',
    lure: 'ಒಂದು ವೆಬ್‌ಸೈಟ್ ಅಥವಾ ವ್ಯಕ್ತಿ "ಪರಿಶೀಲನೆ" ಅಥವಾ "ಸರಿಪಡಿಸಲು" Win+R ಅಥವಾ Ctrl+V ನಂತಹ ಕೀಗಳನ್ನು ಒತ್ತಲು ಹೇಳಿದರು',
    examples: 'ಉದಾಹರಣೆ ಪ್ರಯತ್ನಿಸಿ:',
    ex_installer: 'ಅಧಿಕೃತ ಇನ್‌ಸ್ಟಾಲರ್',
    ex_suspicious: 'ಸಂಶಯಾಸ್ಪದ ಕಮಾಂಡ್',
    ex_signin: 'ಸೈನ್-ಇನ್ ಕೋಡ್',
    empty: 'ಈ ಕಮಾಂಡ್ ಏನು ಮಾಡುತ್ತದೆ ಎಂದು ನೋಡಲು ಮೇಲೆ ಅಂಟಿಸಿ.',
    nothing: 'ಅಪಾಯಕಾರಿ ಏನೂ ಕಂಡುಬಂದಿಲ್ಲ.',
    safeNote: 'ಆದರೂ, ನಂಬಿಕಸ್ಥ ವ್ಯಕ್ತಿಗಳು ಮತ್ತು ಸೈಟ್‌ಗಳ ಕಮಾಂಡ್‌ಗಳನ್ನು ಮಾತ್ರ ಚಲಾಯಿಸಿ.',
    risk: 'ಅಪಾಯ',
    contacts: 'ಇದು ಸಂಪರ್ಕಿಸುವ ವೆಬ್‌ಸೈಟ್‌ಗಳು',
    howRead: 'OwlCept ಇದನ್ನು ಹೇಗೆ ಓದಿತು, ಹಂತ ಹಂತವಾಗಿ',
    pasted: 'ನೀವು ಅಂಟಿಸಿದ್ದು',
    fromStep: 'ಹಂತ {n} ರಿಂದ',
    privacy: 'ಇದು ಸಂಪೂರ್ಣವಾಗಿ ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಚಲಿಸುತ್ತದೆ. ನೀವು ಅಂಟಿಸಿದ್ದು ಎಲ್ಲಿಗೂ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ: ಈ ಪುಟಕ್ಕೆ ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕಕ್ಕೆ ಅನುಮತಿಯೇ ಇಲ್ಲ.',
    privacyApp: 'ಇದು ಸಂಪೂರ್ಣವಾಗಿ ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲಿ ಚಲಿಸುತ್ತದೆ. ನೀವು ಪರಿಶೀಲಿಸಿದ್ದು ಎಲ್ಲಿಗೂ ಅಪ್‌ಲೋಡ್ ಆಗುವುದಿಲ್ಲ: ಈ ಆ್ಯಪ್‌ಗೆ ಇಂಟರ್ನೆಟ್ ಬಳಸಲು ಅನುಮತಿಯೇ ಇಲ್ಲ.',
  },
};

export function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => params[k] ?? '');
}
