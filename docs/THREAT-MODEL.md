# Threat model and privacy note

OwlCept stops ClickFix-family attacks: a person is persuaded to copy an attacker's
command and run it themselves, or to paste a sign-in code into the attacker's page.
This note says what OwlCept protects, from whom, where it can be beaten, and what data
it keeps. It covers the parts in this repository (engine, browser extension, web
checker, Android app, CLI). The Windows agent, built by the team, is in scope only
where it meets them.

## What is protected

| Asset | Threat |
|---|---|
| The PC | A pasted command downloads and runs malware (stealers, remote-access trojans, ransomware loaders) |
| Accounts | A ConsentFix paste hands over an OAuth code; passkeys and two-step login do not help |
| The clipboard's contents | OwlCept itself must not become a way for clipboard text to leave the device |

## Who attacks, and how

| Adversary | Capability | What OwlCept relies on |
|---|---|---|
| Lure page operator | Controls a page's HTML and scripts; writes the clipboard; hides the text; changes wording and obfuscation constantly | Signals that do not depend on the payload: text written by script that the page never showed, lure words near the click, a CAPTCHA not served by a real provider. Decoding of 14 obfuscation layers adds an independent second signal |
| Compromised legitimate site | A real site, often trusted, serving a lure (700+ in the May 2026 Ghost CMS campaign) | Trusted sites skip **warnings only**; a block on a trusted site still blocks |
| Chat or email social engineer | Sends the command in WhatsApp, Teams or email, posing as support or a colleague | Source naming (`classifySource`) adds weight and says where it came from; the paste and commit checks still read the command |
| Target hopper | Moves from the Run box to Windows Terminal, File Explorer or a web form | Three checkpoints share one custody record; the commit check still reads the final command |
| Malicious page script vs. OwlCept | Runs in the same JavaScript world as `hook.ts` | See *Where it can be beaten* |
| Hostile export file | A crafted `.json` dropped into the fleet view | `parseReport` keeps only known fields of the right type and size; all rendering is `textContent`; CSV cells that start with `= + - @` are neutralised |

## Trust boundaries

1. **Page world → isolated world.** `hook.ts` runs in the page's world and only
   *reports* clipboard writes. Every decision is made in the isolated content script,
   which page code cannot reach. The warning lives in a closed shadow root that page
   CSS and scripts cannot restyle or click.
2. **Extension → Windows agent.** Native Messaging, restricted by `allowed_origins` to
   the extension's fixed ID (`jjkhmdbenclipofjaeeblabpmjdcibpi`). Only hashes and
   metadata cross it.
3. **Organisation → extension.** Browser policy under `HKLM` (admin-only) overrides and
   locks settings; values are validated (`clean()`) because policy is still input.
4. **Exports → fleet view.** Files are untrusted; the page's CSP forbids any network
   connection.

## Where it can be beaten (and the backstop)

| Weakness | Why it exists | Backstop |
|---|---|---|
| A page can undo `hook.ts` (for example by borrowing a clean `Clipboard` from a fresh iframe) | Any script in the page world can | The isolated-world copy listener still records manual copies; the agent's clipboard listener sees every write; the commit check reads the command |
| A clipboard write goes through unchanged if the verdict takes longer than 400 ms | Never breaking a site's copy button matters more than a rare slow verdict (the engine's p95 is ~0.01 ms) | Paste and commit checks |
| Copies inside Chrome's built-in PDF viewer are not visible to content scripts | Browser limitation | The agent sees the clipboard write from the browser process |
| A command with no risky behaviour and no lure context passes | By design: provenance alone never prompts (the two-signal rule), so developers are not interrupted | It does nothing harmful by itself; a later stage meets the same checks |
| A brand-new technique the rules do not know | Rules are static and offline | Content-independent signals (hidden copy, lure words, fake CAPTCHA) still fire; the benchmark corpus grows with each new campaign |
| The page draws its own fake "OwlCept says it is safe" box | A page can draw anything | OwlCept never approves a command on a page; it only stops or warns |
| Huge pastes | Work per paste is bounded at 64 KB | Long whitespace is squeezed first and both ends are kept, so padding cannot push the command out of view (regression-tested) |

## Privacy note

**Clipboard text never leaves the device.** No part of OwlCept makes a network request
on its own. The browser test records every request during a full run and fails unless
the only traffic is the test's own pages: **0 bytes sent**. It is checked to fail when
a leak is injected.

| Data | Where | How long | Contains |
|---|---|---|---|
| Custody record | `chrome.storage.session` (memory) | 24 hours, gone when the browser closes | SHA-256 of the normalised text, origin URL, script-written / visible flags, lure words found, fake-CAPTCHA flag, time |
| Activity log | `chrome.storage.local` | Last 1,000 events, until cleared from the dashboard | Time, kind, site host, finding ids, fingerprint; the full page URL **only** for blocks and ConsentFix (the lure page) |
| Settings | `chrome.storage.local` / managed policy | Until changed | Mode, language, trusted sites, trusted contact number, device label |
| Device id | `chrome.storage.local` | Until the extension is removed | Random UUID, used only to tell devices apart in fleet exports |

What leaves the device happens only when the user clicks:

- **Ask someone I trust** / **Send weekly summary** opens WhatsApp with the warning
  text or the counts and hosts. Never the copied text.
- **Report this page** (opt-in setting) opens Google Safe Browsing's public form with
  the lure page's address filled in. The user submits it there.
- **Export** writes a file to the user's own disk.

The web checker and the Android app make no network requests at all; the web pages'
Content-Security-Policy sets `connect-src 'none'`, and the Android app requests no
permissions.

## Safety of the project itself

Every test sample is defanged: hosts are fictional `*.test` names or TEST-NET
addresses, and nothing is ever executed. Lure pages and the malicious benchmark corpus
are assembled by the team inside isolated VMs, per the brief's safety rules.
