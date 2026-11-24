# Unofficial Telegram Agent Connector

A local Windows desktop app that connects to real Telegram accounts through the visible Telegram Web interface and makes controlled Telegram operations available to local automation.

It does **not** use the Telegram API. There is no `api_id`, `api_hash`, bot token, MTProto client, or session string. You sign in yourself in a real browser window, and the app keeps that browser session on your machine.

> Unofficial and not affiliated with Telegram. Use at your own risk.

## Why

Telegram's official APIs require API credentials and do not fit every account or workflow. This connector takes a different route: it drives Telegram Web in a real Chrome for Testing window with Playwright. Any account you can log into manually can be used, and your credentials are never shared with the app or with a third party.

## Features

- **Manual login only** — QR code, phone number, and two-step password are entered by you in the Telegram Web window. The connector never reads or stores them.
- **Multi-account** — every account gets its own persistent Chromium profile and isolated session. Up to three browsers can run at once.
- **Session persistence** — closing the app keeps the profile; reconnecting reuses the existing Telegram session until Telegram asks for login again.
- **Manual proxy** — SOCKS5 or HTTP proxy for all accounts, with optional credentials encrypted through Windows DPAPI. The built-in test opens a real TCP tunnel to `web.telegram.org:443`.
- **Read operations** — list chats, search chats, read visible messages, inspect chat metadata, and check UI health.
- **Send and reply** — a message is prepared first, shown in a native confirmation dialog, and only submitted after you approve it. Ambiguous results are reported without retrying.
- **Local-first** — account metadata, browser profiles, logs, and caches stay under `%LOCALAPPDATA%`. No cloud service, database, or telemetry.

## How it works

| Layer | Technology | Role |
|---|---|---|
| Desktop shell | Electron 45 | App lifecycle, windows, secure IPC |
| UI | React 19 + TypeScript | Account dashboard, messaging, diagnostics |
| Telegram driver | Playwright 1.65 + Chrome for Testing | Logs into and drives `web.telegram.org/k/` |
| Data | JSON files | Account registry, proxy settings, logs |

The renderer is sandboxed: no Node.js, no filesystem, no `ipcRenderer`. It can only call the allowlisted `window.api` bridge. Every IPC payload is validated in the main process, and production builds enforce a strict Content Security Policy.

## Requirements

- Windows 11 x64 (primary target)
- Node.js `26.13.0` with npm
- A Telegram account

## Getting started

```sh
npm install
npx playwright install chromium
npm run dev
```

Then, in the app:

1. **Add Account** and give it a label.
2. **Connect** — a Telegram Web window opens in its own browser profile.
3. Log in there (QR, phone, 2FA). The connector only detects that the chat list became visible.
4. Use **Telegram diagnostics** for chat list, search, messages, and UI health, or **Messaging** to prepare a send or reply.

### Proxy

If Telegram is unreachable on your network, fill in **Network / Proxy** with a SOCKS5 or HTTP proxy and use **Test Proxy** before connecting. There is no automatic fallback: if the proxy is down, Telegram will not load and the app reports the failure instead of connecting directly.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run the app in development |
| `npm run build` | Build into `out/` |
| `npm start` | Preview the production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier check |
| `npm test` | Unit, integration, and E2E tests |
| `npm run check` | All quality gates |

## Project structure

```
src/
  main/       Electron main process: lifecycle, IPC, accounts, Telegram service
  preload/    Sandboxed window.api bridge
  renderer/   React UI
  shared/     Types and IPC contracts
  core/       Browser manager, Telegram surface, proxy, and account primitives
tests/
  unit/         Pure logic
  integration/  Real Chromium against local fixtures
  e2e/          Real Electron app
spike/        Phase 0 feasibility scripts kept for reference
```

## Data and privacy

Everything is stored locally:

```
%LOCALAPPDATA%\UnofficialTelegramAgentConnector\
  config\accounts.json    account labels and profile paths
  config\proxy.json       proxy settings; credentials encrypted with DPAPI
  profiles\<id>\          one Chromium user-data directory per account
  logs\ cache\ backups\
```

Nothing is uploaded. The app stores no Telegram password, login code, QR payload, cookie, or message content in its own files. The browser profile holds the session, exactly as a normal browser would.

## Limitations

- Telegram Web is not a stable API. A UI change can break selectors; the connector then fails safely with a clear error instead of guessing.
- Only `web.telegram.org/k/` is supported.
- Automating Telegram Web may not be permitted by Telegram's Terms of Service. This project is unofficial and comes with no warranty.
- Installer packaging and the MCP bridge that will expose these operations to external agents are not implemented yet.
- AI content processing is deliberately disabled; no message content leaves the machine.

## Status

Implemented: feasibility spike, Electron foundation, browser manager, manual proxy, multi-account management, read-only chat surface, and confirmed send/reply. Next: packaging and the local MCP bridge.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Telegram. "Telegram" is a trademark of its respective owner. Use it only with accounts you own and in compliance with applicable terms and laws.
