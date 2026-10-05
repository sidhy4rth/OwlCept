// Plain-language warnings. Template-based on purpose: an AI call would send
// clipboard text off the device, and the warning must work offline.
// Hindi and Kannada strings should be reviewed by native speakers before release.

import type { Explanation, Finding, Lang, Verdict } from './types.ts';
import { hostOfUrl } from './hosts.ts';
import type { CustodyRecord } from './types.ts';

type Table = Record<string, string>;

const HEADLINES: Record<Lang, Table> = {
  en: {
    'block-hidden': 'Stopped: this website tried to make you run a hidden command.',
    'block-lure': 'Stopped: this page tricked you into running a command.',
    block: 'Stopped: this command could take over your computer.',
    warn: 'Check before you run this: the command looks risky.',
    allow: 'Looks safe.',
  },
  hi: {
    'block-hidden': 'रोका गया: इस वेबसाइट ने आपसे एक छिपा हुआ कमांड चलवाने की कोशिश की।',
    'block-lure': 'रोका गया: इस पेज ने धोखे से आपसे कमांड चलवाने की कोशिश की।',
    block: 'रोका गया: यह कमांड आपके कंप्यूटर पर कब्ज़ा कर सकता है।',
    warn: 'चलाने से पहले जाँच लें: यह कमांड जोखिम भरा लगता है।',
    allow: 'यह सुरक्षित लगता है।',
  },
  kn: {
    'block-hidden': 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ: ಈ ವೆಬ್‌ಸೈಟ್ ನಿಮ್ಮಿಂದ ಒಂದು ಅಡಗಿಸಿದ ಕಮಾಂಡ್ ಚಲಾಯಿಸಲು ಪ್ರಯತ್ನಿಸಿತು.',
    'block-lure': 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ: ಈ ಪುಟ ನಿಮ್ಮನ್ನು ಮೋಸಗೊಳಿಸಿ ಕಮಾಂಡ್ ಚಲಾಯಿಸಲು ಪ್ರಯತ್ನಿಸಿತು.',
    block: 'ತಡೆಹಿಡಿಯಲಾಗಿದೆ: ಈ ಕಮಾಂಡ್ ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್ ಅನ್ನು ವಶಪಡಿಸಿಕೊಳ್ಳಬಹುದು.',
    warn: 'ಚಲಾಯಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ: ಈ ಕಮಾಂಡ್ ಅಪಾಯಕಾರಿಯಾಗಿ ಕಾಣುತ್ತದೆ.',
    allow: 'ಇದು ಸುರಕ್ಷಿತವಾಗಿ ಕಾಣುತ್ತದೆ.',
  },
};

const DETAILS: Record<Lang, Table> = {
  en: {
    'download-exec': 'It would download a program from {host} and run it.',
    installer: 'It installs software from {host}, an official installer site.',
    'download-file': 'It downloads a file from {host}.',
    'hidden-window': 'It runs invisibly, so you would not see what it does.',
    'remote-script-host': 'It uses a built-in Windows tool to run code straight from the internet.',
    'mshta-local': 'It runs an HTML application file, a common way to start malware.',
    'certutil-decode': 'It misuses a Windows certificate tool to download or unpack hidden files.',
    'finger-staging': 'It uses an old network tool (finger) to fetch hidden instructions from another computer.',
    'dns-staging': 'It hides its next instructions inside internet address lookups (DNS).',
    persistence: 'It sets itself up to start again every time you turn on the computer.',
    'defense-evasion': 'It tries to switch off or blind your antivirus.',
    'clear-tracks': 'It deletes the record of what was run, to cover its tracks.',
    'temp-exec': 'It saves a program in a temporary folder and runs it from there.',
    'exec-policy-bypass': "It switches off PowerShell's script safety setting.",
    'mac-quarantine-strip': "It removes macOS's safety check on downloaded apps.",
    'password-prompt': 'It shows a fake box asking for your computer password, or reads saved passwords.',
    'decode-to-shell': 'It unpacks hidden text and runs it as a command.',
    'reverse-shell': 'It opens a direct connection that lets someone else control your computer.',
    'browser-data': 'It reaches for saved browser passwords, cookies or crypto wallets.',
    'ip-address': 'It connects to a bare internet address ({host}) instead of a named website.',
    'risky-domain': 'The site it contacts ({host}) uses a web address ending often seen in scams.',
    'staging-host': 'It fetches content from {host}, a free file or tunnel service attackers often use.',
    'network-share': 'It runs something from a remote network folder ({host}).',
    'plain-http': 'It uses an unencrypted connection to {host}.',
    'decoy-comment': 'It hides behind a fake note ("{text}") so the command looks like a verification step.',
    'decoy-path': 'It ends with a fake file path ("{text}") so the command looks like a document address.',
    obfuscated: 'The command is deliberately disguised so it is hard to read.',
    'hidden-copy': 'The text you copied is different from what the page showed you.',
    'script-copy': 'The page put this text on your clipboard by itself.',
    'lure-words': 'The page told you to press keys like {words}. Real websites never ask you to do this.',
    'lure-words-nearby': 'The page mentions keys like {words}.',
    'fake-captcha': 'The "verify you are human" box was not a real CAPTCHA.',
    'from-app': 'It came from {app}.',
    'target-run': 'You were about to run it from the Run box.',
    'target-explorer': 'You were about to run it from the File Explorer address bar.',
    'same-site': 'It matches the website you copied it from ({host}).',
    'docs-site': 'You copied it from {host}, a documentation site.',
  },
  hi: {
    'download-exec': 'यह {host} से एक प्रोग्राम डाउनलोड करके चला देगा।',
    installer: 'यह {host} से सॉफ़्टवेयर इंस्टॉल करता है, जो एक आधिकारिक इंस्टॉलर साइट है।',
    'download-file': 'यह {host} से एक फ़ाइल डाउनलोड करता है।',
    'hidden-window': 'यह छिपकर चलेगा, इसलिए आप नहीं देख पाएँगे कि यह क्या कर रहा है।',
    'remote-script-host': 'यह Windows के एक अंदरूनी टूल से सीधे इंटरनेट का कोड चलाता है।',
    'mshta-local': 'यह एक HTA फ़ाइल चलाता है, जो मैलवेयर शुरू करने का आम तरीका है।',
    'certutil-decode': 'यह Windows के सर्टिफ़िकेट टूल का गलत इस्तेमाल करके छिपी फ़ाइलें डाउनलोड करता है या खोलता है।',
    'finger-staging': 'यह एक पुराने नेटवर्क टूल (finger) से दूसरे कंप्यूटर से छिपे निर्देश मँगाता है।',
    'dns-staging': 'यह अपने अगले निर्देश इंटरनेट पते की खोज (DNS) में छिपाकर लाता है।',
    persistence: 'यह खुद को ऐसे सेट करता है कि हर बार कंप्यूटर चालू होने पर फिर से चले।',
    'defense-evasion': 'यह आपके एंटीवायरस को बंद करने या अंधा करने की कोशिश करता है।',
    'clear-tracks': 'यह अपने निशान मिटाने के लिए चलाए गए कमांड का रिकॉर्ड हटा देता है।',
    'temp-exec': 'यह एक प्रोग्राम को अस्थायी फ़ोल्डर में रखकर वहीं से चलाता है।',
    'exec-policy-bypass': 'यह PowerShell की स्क्रिप्ट सुरक्षा सेटिंग बंद कर देता है।',
    'mac-quarantine-strip': 'यह डाउनलोड किए गए ऐप्स पर macOS की सुरक्षा जाँच हटा देता है।',
    'password-prompt': 'यह आपके कंप्यूटर का पासवर्ड माँगने वाला नकली बॉक्स दिखाता है या सेव किए गए पासवर्ड पढ़ता है।',
    'decode-to-shell': 'यह छिपे हुए टेक्स्ट को खोलकर उसे कमांड की तरह चलाता है।',
    'reverse-shell': 'यह एक सीधा कनेक्शन खोलता है जिससे कोई और आपका कंप्यूटर चला सकता है।',
    'browser-data': 'यह ब्राउज़र में सेव पासवर्ड, कुकीज़ या क्रिप्टो वॉलेट तक पहुँचने की कोशिश करता है।',
    'ip-address': 'यह किसी नाम वाली वेबसाइट की जगह सीधे एक इंटरनेट पते ({host}) से जुड़ता है।',
    'risky-domain': 'जिस साइट ({host}) से यह जुड़ता है, उसका पता अक्सर धोखाधड़ी वाली साइटों में दिखता है।',
    'staging-host': 'यह {host} से सामग्री लाता है, जो एक मुफ़्त सेवा है जिसका हमलावर अक्सर इस्तेमाल करते हैं।',
    'network-share': 'यह एक दूर के नेटवर्क फ़ोल्डर ({host}) से कुछ चलाता है।',
    'plain-http': 'यह {host} के साथ बिना एन्क्रिप्शन वाला कनेक्शन इस्तेमाल करता है।',
    'decoy-comment': 'यह एक नकली नोट ("{text}") के पीछे छिपा है ताकि कमांड सत्यापन जैसा लगे।',
    'decoy-path': 'इसके अंत में एक नकली फ़ाइल पता ("{text}") है ताकि कमांड किसी दस्तावेज़ का पता लगे।',
    obfuscated: 'कमांड को जानबूझकर छिपाया गया है ताकि इसे पढ़ना मुश्किल हो।',
    'hidden-copy': 'आपने जो टेक्स्ट कॉपी किया, वह पेज पर दिखाए गए टेक्स्ट से अलग है।',
    'script-copy': 'पेज ने यह टेक्स्ट अपने आप आपके क्लिपबोर्ड पर डाल दिया।',
    'lure-words': 'पेज ने आपसे {words} जैसी कुंजियाँ दबाने को कहा। असली वेबसाइटें ऐसा कभी नहीं कहतीं।',
    'lure-words-nearby': 'पेज पर {words} जैसी कुंजियों का ज़िक्र है।',
    'fake-captcha': '"मैं इंसान हूँ" वाला बॉक्स असली CAPTCHA नहीं था।',
    'from-app': 'यह {app} से आया था।',
    'target-run': 'आप इसे Run बॉक्स से चलाने वाले थे।',
    'target-explorer': 'आप इसे File Explorer के पता बार से चलाने वाले थे।',
    'same-site': 'यह उसी वेबसाइट ({host}) से मेल खाता है जहाँ से आपने इसे कॉपी किया।',
    'docs-site': 'आपने इसे {host} से कॉपी किया, जो एक डॉक्यूमेंटेशन साइट है।',
  },
  kn: {
    'download-exec': 'ಇದು {host} ನಿಂದ ಒಂದು ಪ್ರೋಗ್ರಾಂ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ ಚಲಾಯಿಸುತ್ತದೆ.',
    installer: 'ಇದು ಅಧಿಕೃತ ಇನ್‌ಸ್ಟಾಲರ್ ಸೈಟ್ ಆದ {host} ನಿಂದ ಸಾಫ್ಟ್‌ವೇರ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡುತ್ತದೆ.',
    'download-file': 'ಇದು {host} ನಿಂದ ಒಂದು ಫೈಲ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡುತ್ತದೆ.',
    'hidden-window': 'ಇದು ಕಾಣದಂತೆ ಚಲಿಸುತ್ತದೆ, ಆದ್ದರಿಂದ ಅದು ಏನು ಮಾಡುತ್ತಿದೆ ಎಂದು ನಿಮಗೆ ಕಾಣುವುದಿಲ್ಲ.',
    'remote-script-host': 'ಇದು Windows ನ ಒಳಗಿನ ಉಪಕರಣವನ್ನು ಬಳಸಿ ಇಂಟರ್ನೆಟ್‌ನಿಂದ ನೇರವಾಗಿ ಕೋಡ್ ಚಲಾಯಿಸುತ್ತದೆ.',
    'mshta-local': 'ಇದು HTA ಫೈಲ್ ಅನ್ನು ಚಲಾಯಿಸುತ್ತದೆ; ಮಾಲ್‌ವೇರ್ ಆರಂಭಿಸಲು ಇದು ಸಾಮಾನ್ಯ ವಿಧಾನ.',
    'certutil-decode': 'ಇದು Windows ಪ್ರಮಾಣಪತ್ರ ಉಪಕರಣವನ್ನು ದುರುಪಯೋಗ ಮಾಡಿ ಅಡಗಿಸಿದ ಫೈಲ್‌ಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡುತ್ತದೆ ಅಥವಾ ತೆರೆಯುತ್ತದೆ.',
    'finger-staging': 'ಇದು ಹಳೆಯ ನೆಟ್‌ವರ್ಕ್ ಉಪಕರಣ (finger) ಬಳಸಿ ಇನ್ನೊಂದು ಕಂಪ್ಯೂಟರ್‌ನಿಂದ ಅಡಗಿಸಿದ ಸೂಚನೆಗಳನ್ನು ತರುತ್ತದೆ.',
    'dns-staging': 'ಇದು ತನ್ನ ಮುಂದಿನ ಸೂಚನೆಗಳನ್ನು ಇಂಟರ್ನೆಟ್ ವಿಳಾಸ ಹುಡುಕಾಟದಲ್ಲಿ (DNS) ಅಡಗಿಸಿ ತರುತ್ತದೆ.',
    persistence: 'ಕಂಪ್ಯೂಟರ್ ಆನ್ ಮಾಡಿದ ಪ್ರತಿ ಬಾರಿಯೂ ಮತ್ತೆ ಆರಂಭವಾಗುವಂತೆ ಇದು ತನ್ನನ್ನು ಹೊಂದಿಸಿಕೊಳ್ಳುತ್ತದೆ.',
    'defense-evasion': 'ಇದು ನಿಮ್ಮ ಆಂಟಿವೈರಸ್ ಅನ್ನು ಆಫ್ ಮಾಡಲು ಅಥವಾ ಕುರುಡಾಗಿಸಲು ಪ್ರಯತ್ನಿಸುತ್ತದೆ.',
    'clear-tracks': 'ತನ್ನ ಕುರುಹು ಅಳಿಸಲು ಇದು ಚಲಾಯಿಸಿದ ಕಮಾಂಡ್‌ಗಳ ದಾಖಲೆಯನ್ನು ಅಳಿಸುತ್ತದೆ.',
    'temp-exec': 'ಇದು ಒಂದು ಪ್ರೋಗ್ರಾಂ ಅನ್ನು ತಾತ್ಕಾಲಿಕ ಫೋಲ್ಡರ್‌ನಲ್ಲಿ ಉಳಿಸಿ ಅಲ್ಲಿಂದಲೇ ಚಲಾಯಿಸುತ್ತದೆ.',
    'exec-policy-bypass': 'ಇದು PowerShell ನ ಸ್ಕ್ರಿಪ್ಟ್ ಸುರಕ್ಷತಾ ಸೆಟ್ಟಿಂಗ್ ಅನ್ನು ಆಫ್ ಮಾಡುತ್ತದೆ.',
    'mac-quarantine-strip': 'ಡೌನ್‌ಲೋಡ್ ಮಾಡಿದ ಆ್ಯಪ್‌ಗಳ ಮೇಲಿನ macOS ಸುರಕ್ಷತಾ ಪರಿಶೀಲನೆಯನ್ನು ಇದು ತೆಗೆದುಹಾಕುತ್ತದೆ.',
    'password-prompt': 'ಇದು ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್ ಪಾಸ್‌ವರ್ಡ್ ಕೇಳುವ ನಕಲಿ ಬಾಕ್ಸ್ ತೋರಿಸುತ್ತದೆ ಅಥವಾ ಉಳಿಸಿದ ಪಾಸ್‌ವರ್ಡ್‌ಗಳನ್ನು ಓದುತ್ತದೆ.',
    'decode-to-shell': 'ಇದು ಅಡಗಿಸಿದ ಪಠ್ಯವನ್ನು ಬಿಚ್ಚಿ ಕಮಾಂಡ್ ಆಗಿ ಚಲಾಯಿಸುತ್ತದೆ.',
    'reverse-shell': 'ಇದು ಬೇರೆಯವರು ನಿಮ್ಮ ಕಂಪ್ಯೂಟರ್ ನಿಯಂತ್ರಿಸಲು ಅವಕಾಶ ನೀಡುವ ನೇರ ಸಂಪರ್ಕವನ್ನು ತೆರೆಯುತ್ತದೆ.',
    'browser-data': 'ಇದು ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಉಳಿಸಿದ ಪಾಸ್‌ವರ್ಡ್‌ಗಳು, ಕುಕೀಗಳು ಅಥವಾ ಕ್ರಿಪ್ಟೋ ವಾಲೆಟ್‌ಗಳನ್ನು ತಲುಪಲು ಪ್ರಯತ್ನಿಸುತ್ತದೆ.',
    'ip-address': 'ಇದು ಹೆಸರಿರುವ ವೆಬ್‌ಸೈಟ್ ಬದಲು ನೇರವಾಗಿ ಒಂದು ಇಂಟರ್ನೆಟ್ ವಿಳಾಸಕ್ಕೆ ({host}) ಸಂಪರ್ಕಿಸುತ್ತದೆ.',
    'risky-domain': 'ಇದು ಸಂಪರ್ಕಿಸುವ ಸೈಟ್‌ನ ({host}) ವಿಳಾಸವು ಮೋಸದ ಸೈಟ್‌ಗಳಲ್ಲಿ ಹೆಚ್ಚಾಗಿ ಕಾಣುತ್ತದೆ.',
    'staging-host': 'ಇದು ದಾಳಿಕೋರರು ಹೆಚ್ಚಾಗಿ ಬಳಸುವ ಉಚಿತ ಸೇವೆಯಾದ {host} ನಿಂದ ವಿಷಯವನ್ನು ತರುತ್ತದೆ.',
    'network-share': 'ಇದು ದೂರದ ನೆಟ್‌ವರ್ಕ್ ಫೋಲ್ಡರ್‌ನಿಂದ ({host}) ಏನನ್ನೋ ಚಲಾಯಿಸುತ್ತದೆ.',
    'plain-http': 'ಇದು {host} ಜೊತೆ ಎನ್‌ಕ್ರಿಪ್ಟ್ ಆಗದ ಸಂಪರ್ಕವನ್ನು ಬಳಸುತ್ತದೆ.',
    'decoy-comment': 'ಕಮಾಂಡ್ ಪರಿಶೀಲನೆಯ ಹಂತದಂತೆ ಕಾಣಲು ಇದು ಒಂದು ನಕಲಿ ಟಿಪ್ಪಣಿಯ ("{text}") ಹಿಂದೆ ಅಡಗಿದೆ.',
    'decoy-path': 'ಕಮಾಂಡ್ ದಾಖಲೆಯ ವಿಳಾಸದಂತೆ ಕಾಣಲು ಇದರ ಕೊನೆಯಲ್ಲಿ ನಕಲಿ ಫೈಲ್ ವಿಳಾಸ ("{text}") ಇದೆ.',
    obfuscated: 'ಓದಲು ಕಷ್ಟವಾಗುವಂತೆ ಕಮಾಂಡ್ ಅನ್ನು ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ಮರೆಮಾಚಲಾಗಿದೆ.',
    'hidden-copy': 'ನೀವು ನಕಲಿಸಿದ ಪಠ್ಯವು ಪುಟದಲ್ಲಿ ತೋರಿಸಿದ್ದಕ್ಕಿಂತ ಬೇರೆಯಾಗಿದೆ.',
    'script-copy': 'ಪುಟವು ಈ ಪಠ್ಯವನ್ನು ತಾನಾಗಿಯೇ ನಿಮ್ಮ ಕ್ಲಿಪ್‌ಬೋರ್ಡ್‌ಗೆ ಹಾಕಿದೆ.',
    'lure-words': 'ಪುಟವು ನಿಮಗೆ {words} ನಂತಹ ಕೀಗಳನ್ನು ಒತ್ತಲು ಹೇಳಿತು. ನಿಜವಾದ ವೆಬ್‌ಸೈಟ್‌ಗಳು ಎಂದಿಗೂ ಹೀಗೆ ಕೇಳುವುದಿಲ್ಲ.',
    'lure-words-nearby': 'ಪುಟದಲ್ಲಿ {words} ನಂತಹ ಕೀಗಳ ಉಲ್ಲೇಖವಿದೆ.',
    'fake-captcha': '"ನಾನು ಮನುಷ್ಯ" ಎಂಬ ಬಾಕ್ಸ್ ನಿಜವಾದ CAPTCHA ಆಗಿರಲಿಲ್ಲ.',
    'from-app': 'ಇದು {app} ನಿಂದ ಬಂದಿದೆ.',
    'target-run': 'ನೀವು ಇದನ್ನು Run ಬಾಕ್ಸ್‌ನಿಂದ ಚಲಾಯಿಸಲು ಹೊರಟಿದ್ದಿರಿ.',
    'target-explorer': 'ನೀವು ಇದನ್ನು File Explorer ವಿಳಾಸ ಪಟ್ಟಿಯಿಂದ ಚಲಾಯಿಸಲು ಹೊರಟಿದ್ದಿರಿ.',
    'same-site': 'ಇದು ನೀವು ನಕಲಿಸಿದ ವೆಬ್‌ಸೈಟ್‌ಗೆ ({host}) ಹೊಂದಿಕೆಯಾಗುತ್ತದೆ.',
    'docs-site': 'ನೀವು ಇದನ್ನು ದಾಖಲೀಕರಣ ಸೈಟ್ ಆದ {host} ನಿಂದ ನಕಲಿಸಿದ್ದೀರಿ.',
  },
};

const PROVENANCE: Record<Lang, { url: string; app: string }> = {
  en: { url: 'You copied it from {origin}.', app: 'You copied it from {origin}.' },
  hi: { url: 'आपने इसे {origin} से कॉपी किया था।', app: 'आपने इसे {origin} से कॉपी किया था।' },
  kn: { url: 'ನೀವು ಇದನ್ನು {origin} ನಿಂದ ನಕಲಿಸಿದ್ದೀರಿ.', app: 'ನೀವು ಇದನ್ನು {origin} ನಿಂದ ನಕಲಿಸಿದ್ದೀರಿ.' },
};

const ADVICE: Record<Lang, Table> = {
  en: {
    block:
      'Close the page. If someone on a call or in a chat asked you to do this, it is a scam. Real CAPTCHAs and support teams never ask you to open Run or Terminal.',
    warn: 'Only run this if you trust where it came from and know why you need it.',
    allow: 'No warning needed.',
  },
  hi: {
    block:
      'पेज बंद कर दें। अगर किसी कॉल या चैट पर किसी ने ऐसा करने को कहा है, तो यह धोखा है। असली CAPTCHA और सपोर्ट टीमें कभी Run या Terminal खोलने को नहीं कहतीं।',
    warn: 'इसे तभी चलाएँ जब आपको भरोसा हो कि यह कहाँ से आया है और आपको इसकी ज़रूरत क्यों है।',
    allow: 'किसी चेतावनी की ज़रूरत नहीं।',
  },
  kn: {
    block:
      'ಪುಟವನ್ನು ಮುಚ್ಚಿ. ಕರೆ ಅಥವಾ ಚಾಟ್‌ನಲ್ಲಿ ಯಾರಾದರೂ ಇದನ್ನು ಮಾಡಲು ಹೇಳಿದ್ದರೆ, ಇದು ವಂಚನೆ. ನಿಜವಾದ CAPTCHA ಮತ್ತು ಸಹಾಯ ತಂಡಗಳು Run ಅಥವಾ Terminal ತೆರೆಯಲು ಎಂದಿಗೂ ಹೇಳುವುದಿಲ್ಲ.',
    warn: 'ಇದು ಎಲ್ಲಿಂದ ಬಂತು ಎಂದು ನಿಮಗೆ ನಂಬಿಕೆಯಿದ್ದರೆ ಮತ್ತು ಏಕೆ ಬೇಕು ಎಂದು ತಿಳಿದಿದ್ದರೆ ಮಾತ್ರ ಚಲಾಯಿಸಿ.',
    allow: 'ಎಚ್ಚರಿಕೆಯ ಅಗತ್ಯವಿಲ್ಲ.',
  },
};

// Findings that only make sense when explaining why something was allowed.
const REASSURING = new Set(['installer', 'same-site', 'docs-site']);
const MAX_DETAILS = 5;

function fill(template: string, params: Record<string, string> | undefined): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => params?.[k] ?? '');
}

export function explain(verdict: Verdict, custody: CustodyRecord | null | undefined, lang: Lang = 'en'): Explanation {
  const ids = new Set(verdict.findings.map((f) => f.id));
  let headlineKey: string = verdict.action;
  if (verdict.action === 'block') {
    if (ids.has('hidden-copy')) headlineKey = 'block-hidden';
    else if (ids.has('lure-words') || ids.has('fake-captcha')) headlineKey = 'block-lure';
  }

  const ordered = [...verdict.findings]
    .filter((f) => (verdict.action === 'allow' ? true : !REASSURING.has(f.id)))
    .sort((a, b) => order(a) - order(b) || b.weight - a.weight);
  const details = ordered
    .map((f: Finding) => DETAILS[lang][f.id] && fill(DETAILS[lang][f.id], f.params))
    .filter((d): d is string => !!d)
    .slice(0, MAX_DETAILS);

  let provenance: string | undefined;
  const origin = hostOfUrl(custody?.originUrl) ?? (custody?.sourceKind === 'app' ? custody.sourceApp : undefined);
  if (origin) provenance = fill(custody?.originUrl ? PROVENANCE[lang].url : PROVENANCE[lang].app, { origin });

  return { lang, headline: HEADLINES[lang][headlineKey], details, provenance, advice: ADVICE[lang][verdict.action] };
}

/** Behaviour first (what it does), then context (why we think it is a trick). */
function order(f: Finding): number {
  return f.kind === 'behaviour' ? 0 : f.kind === 'obfuscation' ? 1 : 2;
}
