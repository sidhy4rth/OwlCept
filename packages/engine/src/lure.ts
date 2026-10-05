// Lure phrases that ClickFix pages show next to the copy button. The
// extension runs this over the text near the click; it never leaves the page.

interface LurePattern {
  label: string;
  re: RegExp;
}

const KEY = String.raw`\s*(?:\+|plus|and|then)?\s*`;

const PATTERNS: LurePattern[] = [
  { label: 'Win+R', re: new RegExp(String.raw`(?:win(?:dows)?(?:\s*key)?|⊞|❖|\u{1F5D4})${KEY}["']?r\b`, 'iu') },
  { label: 'Win+X', re: new RegExp(String.raw`(?:win(?:dows)?(?:\s*key)?|⊞|❖)${KEY}["']?x\b`, 'iu') },
  { label: 'Ctrl+V', re: new RegExp(String.raw`\b(?:ctrl|control)${KEY}["']?v\b`, 'i') },
  { label: 'Cmd+V', re: new RegExp(String.raw`(?:\bcmd|\bcommand|⌘)${KEY}["']?v\b`, 'iu') },
  { label: 'Cmd+Space', re: new RegExp(String.raw`(?:\bcmd|\bcommand|⌘)${KEY}space`, 'iu') },
  { label: 'Alt+F2', re: new RegExp(String.raw`\balt${KEY}f2\b`, 'i') },
  { label: 'Ctrl+L', re: new RegExp(String.raw`\b(?:ctrl|control)${KEY}l\b[^.]{0,60}(?:explorer|address bar)`, 'i') },
  { label: 'press Enter', re: /\b(?:press|hit|tap)\s+(?:the\s+)?(?:enter|return)\b/i },
  { label: 'open Run', re: /\bopen\s+(?:the\s+)?run\s+(?:dialog|box|window)\b|\brun\s+dialog\b/i },
  { label: 'open Terminal', re: /\b(?:open|launch)\s+(?:the\s+)?(?:terminal|powershell|command prompt|windows terminal)\b/i },
  { label: 'File Explorer address bar', re: /\bfile explorer\b[^.]{0,80}\baddress bar\b|\baddress bar\b[^.]{0,80}\bfile explorer\b/i },
  {
    label: 'verify you are human',
    re: /\b(?:verify|prove|confirm)\s+(?:that\s+)?you(?:'re|\s+are)\s+(?:a\s+)?human\b|\bhuman verification\b|\bverification steps?\b|\bcomplete (?:the )?verification\b/i,
  },
  {
    label: 'I am not a robot',
    re: /\bi(?:'m|\s+am)\s+not\s+a\s+robot\b|मैं रोबोट नहीं|रोबोट नहीं हूँ|ನಾನು ರೋಬೋಟ್ ಅಲ್ಲ|no soy un robot|je ne suis pas un robot|ich bin kein roboter|não sou um robô|non sono un robot|я не робот|ben robot değilim|saya bukan robot/i,
  },
  { label: 'fix the error', re: /\b(?:to fix (?:this|the) (?:issue|error|problem)|fix (?:it|this) (?:manually|yourself))\b[^.]{0,80}\b(?:copy|paste|run)\b/i },
  { label: 'सत्यापन', re: /सत्यापन|सत्यापित करें|ಪರಿಶೀಲನೆ|ಪರಿಶೀಲಿಸಿ/ },
];

/** Returns the lure labels found in the given page text, in a stable order. */
export function detectLureText(text: string): string[] {
  const t = text.normalize('NFKC');
  return PATTERNS.filter((p) => p.re.test(t)).map((p) => p.label);
}

const CAPTCHA_PROVIDERS = [
  'www.google.com/recaptcha',
  'www.recaptcha.net',
  'recaptcha.google.com',
  'www.gstatic.com/recaptcha',
  'hcaptcha.com',
  'newassets.hcaptcha.com',
  'challenges.cloudflare.com',
  'geo.captcha-delivery.com',
  'client-api.arkoselabs.com',
  'api.friendlycaptcha.com',
];

/** True when an iframe/script src belongs to a real CAPTCHA provider. */
export function isRealCaptchaSource(src: string): boolean {
  const u = src.replace(/^https?:\/\//i, '').toLowerCase();
  return CAPTCHA_PROVIDERS.some((p) => u.startsWith(p) || u.split('/')[0].endsWith(`.${p.split('/')[0]}`));
}
