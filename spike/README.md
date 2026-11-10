# Phase 0 Spike — Telegram Web Feasibility

Temporary proof-of-concept for TASK 00. It is **not** part of the shipped application and contains no Electron, MCP or account-management code.

## Safety rules

- No `api_id`, `api_hash`, Bot Token, phone number, login code or 2FA password is requested or stored.
- Login is performed by the user in the visible Chromium window.
- Logs contain only structural facts: URLs, login-state names, selector names and counts.
- Page text, chat titles, cookies, storage state and screenshots are never logged.
- The persistent profile is stored under `spike/profiles/` and is gitignored.

## Setup

Requires Node.js 26.13.0 LTS (portable copy is fine).

```powershell
npm install
npx playwright install chromium
```

If the Playwright CDN is geo-blocked, set an HTTP proxy for the download:

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:<port>"
npx playwright install chromium
```

Runtime proxy for Telegram Web access is opt-in:

```powershell
$env:SPIKE_PROXY = "http://127.0.0.1:<port>"
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run probe` | Launch headed Chromium, load Telegram Web, report login state and selector counts. |
| `npm run login` | Open the login window and wait for the user to complete QR/phone login. |
| `npm run verify` | Reopen the same profile in a new browser process and verify the session and chat list. |
| `npm run locktest` | Prove that a second Chromium instance cannot open the same profile directory. |
| `npm run check` | Typecheck plus log secret/length/JSON validation. |

`SPIKE_LOGIN_TIMEOUT_SEC` (default `900`) controls how long `npm run login` waits.

## Evidence

`spike/logs/spike-state.jsonl` contains the machine-readable evidence used in `docs/spike/PHASE0_REPORT.md`.
