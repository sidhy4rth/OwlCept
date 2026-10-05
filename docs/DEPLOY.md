# Deploying OwlCept in a college or office

OwlCept runs on a personal PC with no console at all. For a lab, a hostel network or a
small office, IT can also push its settings, lock them, and collect what it stopped,
without any server and without clipboard text ever leaving a PC.

| Need | How |
|---|---|
| Same settings on every PC, locked | Browser policy for the extension, set by [`Set-OwlCeptPolicy.ps1`](../deploy/windows/Set-OwlCeptPolicy.ps1) or the example [`.reg`](../deploy/windows/owlcept-policy-example.reg) |
| Install it on every PC | Force-install through Chrome or Edge policy (below) |
| See what was stopped across PCs | Each PC exports its log from the dashboard; the [fleet view](../web/README.md#fleet-view) merges the files in the browser |
| Measure before enforcing | Start in **audit** mode for a week: everything is logged, nobody is interrupted. Check the fleet view, add the college's own doc sites as trusted, then switch to **smart** |

The extension ID is fixed by the public key in the manifest: **`jjkhmdbenclipofjaeeblabpmjdcibpi`**.

## Settings IT can set

These are read from `chrome.storage.managed`
([schema](../extension/static/managed_schema.json)). A value set by policy wins over the
user's choice and shows with a 🔒 in the popup and dashboard.

| Policy | Type | Meaning |
|---|---|---|
| `mode` | `audit` · `smart` · `strict` | Log only / block attacks and warn on doubtful commands / every warning blocks |
| `lang` | `auto` · `en` · `hi` · `kn` | Warning language |
| `trustedSites` | list of hosts | Warnings are skipped on these and their subdomains. Blocks still apply |
| `contact` | digits | Help desk's WhatsApp number for "Ask someone I trust" |
| `allowCopyAnyway` | boolean | `false` removes "Copy anyway" from blocks |
| `reportLures` | boolean | Offer "Report this page" (opens Google Safe Browsing's form; nothing is sent unless clicked) |
| `deviceLabel` | text | This PC's name in fleet exports |
| `blockedHosts` | list of hosts | **Organisation only.** A command that would contact one of these (or a subdomain) is always blocked; the fleet view generates this list |
| `approvedCommands` | list of SHA-256 | **Organisation only.** Exact commands that never prompt, such as the college's setup script. Get a fingerprint with `owlcept hash "<command>"` |

### Windows: script

```powershell
# As administrator; works as a GPO startup script or an Intune platform script.
.\Set-OwlCeptPolicy.ps1 -Mode audit -TrustedSites docs.example-college.edu.in -HelpDeskWhatsApp 919800000000 -AllowCopyAnyway $false
.\Set-OwlCeptPolicy.ps1 -Remove     # undo
```

It writes the same values for Chrome and Edge under
`HKLM\SOFTWARE\Policies\{Google\Chrome | Microsoft\Edge}\3rdparty\extensions\jjkhmdbenclipofjaeeblabpmjdcibpi\policy`.
CI runs it on a Windows runner on every change and reads the registry back.

Check on a PC with `chrome://policy` or `edge://policy` → *Reload policies*: the
extension's values appear under its ID.

## Force-installing the extension

Once OwlCept is listed in the Chrome Web Store or Edge Add-ons, add its store ID to the
browser's `ExtensionInstallForcelist` policy (Group Policy: *Google Chrome → Extensions →
Configure the list of force-installed apps and extensions*; Edge has the same policy).
A store listing assigns its own ID; set the managed policy under that ID.

Before a listing, Chrome and Edge only force-install extensions from outside their
stores on domain-joined or MDM-managed Windows PCs. Pack `extension/dist` into a `.crx`
with the private key that matches the manifest key, host it with an `update.xml`, and
force-install `jjkhmdbenclipofjaeeblabpmjdcibpi;https://your-server/owlcept/update.xml`.

## Windows agent

The agent registers a Native Messaging host so the extension can hand it custody
records. The host manifest the agent installs is in
[`deploy/native-host/com.owlcept.agent.json`](../deploy/native-host/com.owlcept.agent.json);
its `allowed_origins` already carries the fixed extension ID.
