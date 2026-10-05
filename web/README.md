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

Imported files are treated as untrusted: only known fields of the right type and size
are kept (`parseReport` in the engine), and everything is rendered as text.
