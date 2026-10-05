# Benchmark

`npm run bench` runs every sample through the checkpoints that would see it and
scores the result against the brief's targets. It writes
[`docs/BENCHMARK.md`](../docs/BENCHMARK.md) and `bench/results/latest.json`, and
exits non-zero when a target is missed, so CI fails on a regression.

| Checkpoint | Runs for | Engine call |
|---|---|---|
| Copy (extension) | browser sources | `analyze(text, { target: 'unknown', custody })` |
| Paste (agent) | anything with a custody record | `analyze(text, { target, custody })` |
| Commit (Enter) | every command, including typed ones | `analyze(text, { target, custody })` |
| ConsentFix (extension) | `kind: "oauth"` samples | `checkOAuthPaste(text, pageUrl)` |

A malicious sample counts as **detected** if any checkpoint warns or blocks; a
benign sample is a **false prompt** if any checkpoint does.

## Corpora

- `corpus/benign.ts`: commands copied from official documentation (winget,
  Chocolatey, Scoop, Homebrew, pip, npm, cargo, Docker Hub, Microsoft Learn,
  installer pages), each tagged with the page it comes from.
- `corpus/*.jsonl`: any further corpus, one sample per line. The held-out
  malicious corpus goes here.

### Adding the malicious corpus

The brief asks for at least 200 defanged ClickFix-family samples drawn from
URLhaus, the ClickGrab collection and vendor reports. Before a sample goes in:

- every URL points at a sinkholed or `.test` host, and IPs are in TEST-NET
  (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24);
- the payload is neutralised (`echo SIMULATED-CLICKFIX`);
- lure brands are fictional.

```json
{"id":"cf-0001","label":"malicious","group":"run-dialog","text":"…","target":"run","origin":"https://example-lure.test/verify","copy":"script-hidden","lure":["Win+R","verify you are human"],"fakeCaptcha":true,"suite":{"pasteTarget":"run","source":"browser","obfuscation":"base64","visibility":"hidden"}}
{"id":"cf-0002","label":"malicious","group":"consentfix","kind":"oauth","text":"http://localhost:8400/?code=…","pageUrl":"https://example-lure.test/connect","target":"web","suite":{"pasteTarget":"web-form"}}
{"id":"cf-0003","label":"malicious","group":"chat","text":"…","target":"terminal","app":"WhatsApp.exe","suite":{"source":"chat-app"}}
```

| Field | Meaning |
|---|---|
| `copy` | `button` (visible copy button), `manual` (user selection), `script-hidden` (script wrote text the page never showed), `typed` (no custody record) |
| `lure`, `fakeCaptcha` | What the extension saw near the click |
| `app` | Desktop source app for non-browser copies (sets `sourceKind: "app"`) |
| `custody` | A full custody record, overriding the fields above |
| `suite` | Tags reported as separate detection rates; the brief's suites are paste target, paste method, source, obfuscation and visibility |
