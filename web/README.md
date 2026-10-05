# OwlCept web pages

Static pages, built into `web/dist` with `npm run build -w @owlcept/web`. They work from
any static host or straight from disk (`file://`), and the Android app bundles them.
Each page's Content-Security-Policy sets `connect-src 'none'`: nothing typed, pasted
or dropped into them can leave the browser.

## OwlCept Check

`index.html`. Paste a command someone asked you to run and see what it really does,
in English, Hindi or Kannada.

## Fleet view

`fleet.html`. For a college lab, hostel or office that runs OwlCept on many PCs.

1. On each PC, open the OwlCept popup → **Open activity dashboard** → **Export for fleet view**.
2. Collect the `.json` files (shared drive, USB stick, email to IT).
3. Open `fleet.html` and drop them all in at once.

It shows each device's blocks, warnings, sign-in codes stopped and "copied anyway"
overrides; the lure sites met by the most devices (copyable as a DNS blocklist);
**campaigns**, meaning the same clipboard item, matched by fingerprint, stopped on
several devices; and, for devices in audit mode, how many commands enforcement would
have stopped. Exports from the same device are merged, so a weekly export can simply be
dropped in again.

**Signatures.** Each PC signs its exports with its own key (ECDSA P-256, private half
non-extractable). A file edited after export is listed with the reason and left out of
every number; unsigned files count but are marked; a device whose key changes between
files is flagged. Compare a device's key id with the one on its dashboard.

**Block these sites on every PC.** Tick lure sites, optionally add approved-command
fingerprints, and download the result as a PowerShell command, a `.reg` file for Chrome
and Edge, or browser policy JSON. Only strict host names and fingerprints are written,
so a tampered export cannot inject anything into a file IT runs as administrator.

Imported files are treated as untrusted: only known fields of the right type and size
are kept (`parseReport` in the engine), and everything is rendered as text.

## Warning review

`review.html`. The brief scores explanation accuracy as "90% judged correct, two
reviewers score 50 random warnings".

1. `npm run review-pack` draws a seeded sample of real warnings from the benchmark
   corpora into `bench/review/pack.json` (and says if fewer than 50 exist).
2. Each reviewer opens the pack, picks the language they read, and scores every warning
   **correct**, **partly** or **wrong** (keys 1, 2, 3; arrows to move), with an optional note.
   Scores are kept in the browser and downloaded as a file.
3. **Results**: open both reviewers' files (and the pack). It shows each reviewer's accuracy,
   the mean against the 90% target, the share both judged correct, Cohen's κ with its usual
   reading, and every warning judged wrong or disputed.
