# Phase 0 — Feasibility & Technical Spike Report

Date: 2026-11-10  
Task: `TASKS/00_DISCOVERY_AND_SPIKE.md`  
Status: **Complete — conditional GO**  
Evidence: `spike/logs/spike-state.jsonl`

## 1. Objective

Prove that a real Telegram account can be connected through the visible Telegram Web UI with Playwright, without `api_id`, `api_hash`, Bot Token, MTProto, Telethon/GramJS, private endpoints or reverse engineering. Prove that the Chromium profile survives a browser-process restart and that a profile is locked to one browser instance.

## 2. Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26300, x64 |
| Node.js used for spike | 26.13.0 LTS (official `node-v26.13.0-win-x64.zip`) |
| Node archive SHA-256 | `dcc60d59a0746999f99064a01c020445d54d84228c691cdbf25b49ac3b59150a` (matches official `SHASUMS256.txt`) |
| Package manager | npm 11.20.0 |
| Playwright | 1.65.0 |
| Playwright Chromium | Chrome for Testing 158.0.8127.18, revision 1254 |
| TypeScript (spike) | 5.9.3 |
| MCP SDK (not used in spike) | 1.32.2 |
| Access path | Local HTTP proxy (port intentionally omitted); no Telegram credentials |

## 3. Version research (official sources, 2026-11-10)

| Component | Pinned candidate | Source | Notes |
|---|---|---|---|
| Node.js | 26.13.0 LTS | `https://nodejs.org/dist/index.json` | Current Active LTS, released 2026-10-28 |
| Electron | 45.2.3 | `https://registry.npmjs.org/electron/latest`, `https://releases.electronjs.org/releases.json` | Released 2026-11-04; embeds Chrome 156.0.8078.80, Node 24.22.2; `engines.node >= 22.12.0` |
| Playwright | 1.65.0 | `https://registry.npmjs.org/playwright/latest` | `engines.node >= 20`; bundles Chrome for Testing 158.0.8127.18 |
| MCP TypeScript SDK | 1.32.2 | `https://registry.npmjs.org/@modelcontextprotocol%2Fsdk/latest` | For Phase 5 |
| TypeScript | 5.9.3 | `https://registry.npmjs.org/typescript/5.9.3` | Latest is 7.0.2; 5.9.3 chosen for the spike to avoid unproven compiler/tooling behavior. Re-evaluate in Phase 1. |
| Zod | 4.6.7 | `https://registry.npmjs.org/zod/latest` | For Phase 5 validation |

Playwright and Electron ship different Chromium versions. This is expected and acceptable: Playwright launches its own bundled Chrome for Testing, not Electron's embedded Chromium. Electron's Chromium is used only for the desktop UI.

## 4. Method

- Temporary TypeScript project in `spike/` (not shipped).
- Headed persistent context: `chromium.launchPersistentContext(profileDir, { headless: false, ... })`.
- Profile: `spike/profiles/spike-account/chromium-user-data/`.
- Start URL: `https://web.telegram.org/`.
- Login performed manually by the user in the visible window (QR). The spike never reads or stores login input.
- Login state detected only from visible UI locators, centralized in `spike/src/telegram.ts`.
- Logs are JSONL and contain only URLs, state names, selector names and counts. No page text, chat titles, cookies or storage state.

## 5. Results

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Browser launch | **PASS** | Headed Chrome for Testing launched with a dedicated persistent profile. |
| 2 | Telegram Web load | **PASS** | `https://web.telegram.org/` redirected to `https://web.telegram.org/k/`; title contains "Telegram". |
| 3 | Manual QR login | **PASS** | Login page showed `#auth-pages` + QR canvas; user completed login in the visible window. State changed to `CONNECTED` at 08:43:14 UTC. |
| 4 | Login state detection | **PASS** | Visible-locator detector logged `LOGIN_REQUIRED` before login and `CONNECTED` after. |
| 5 | Persistent profile after process restart | **PASS** | A new Node/Chromium process reopened the same profile at 08:43:29 UTC and detected `CONNECTED` without another login. |
| 6 | Browser close/reopen | **PASS** | No spike `chrome.exe` process remained after scripts exited; profile directory survived. |
| 7 | Chat list readable | **PASS** | `#chatlist-container .chatlist-chat` matched 15 visible items. No titles or message content were read or logged. |
| 8 | Profile lock | **PASS** | A second `launchPersistentContext` on the same profile was rejected: "Opening in existing browser session… profile is already in use by another instance of Chromium." |
| 9 | No credentials in logs | **PASS** | `npm run check` typecheck + JSONL secret/length scan passed. No `api_id`, `api_hash`, Bot Token, cookie, phone number or password in logs. |

### 5.1 Network access

Direct TCP 443 to `web.telegram.org` (149.154.167.99) failed from the test network. A local HTTP proxy reached `https://web.telegram.org/` with HTTP 200. The spike therefore accepts an optional Playwright `proxy` setting. This is an environment constraint, not a Telegram API dependency. It must be addressed before live-user testing (see D-006).

### 5.2 Telegram Web variant and selectors

Observed variant: **WebZ at `/k/`** (the default redirect from `https://web.telegram.org/`).

- Login page: `#auth-pages` visible; QR rendered in `canvas` (2 canvas elements). `#column-left` and `#chatlist-container` exist in the DOM but are **not visible**.
- Logged-in state: `#column-left`, `#chatlist-container` and `.chatlist` visible.
- Chat items: `#chatlist-container .chatlist-chat` (15 items observed).

Consequence for the Adapter: selector **presence is not enough**; every state check must use visibility. The detector already does this. The `/a/` (WebA) variant was not evaluated and is out of scope unless approved.

### 5.3 Manual QR login

The user scanned the QR in the visible Chromium window. The spike received no phone number, QR payload, login code or 2FA password. The QR/canvas was never screenshotted or logged. Detection poll interval was 2 seconds; transition to `CONNECTED` was observed within the next poll.

### 5.4 Session persistence

The login script closed the browser, then a separate Node process reopened the same profile. The session was still valid and the chat list rendered without a new login. This proves the persistent-context mechanism that Phase 2 depends on. A full Windows restart and an Electron app restart are still to be tested in later phases.

### 5.5 Chat list readability

The visible chat list rendered 15 items. Counting via `#chatlist-container .chatlist-chat` is sufficient for Phase 4 feasibility. Reading chat titles/IDs and mapping them to stable tool outputs remains Phase 4 work and is not proven here.

### 5.6 Profile lock and independence

A second browser instance on the same user-data directory was blocked by Chromium's process singleton. The profile is isolated under `spike/profiles/`, not the user's Chrome profile. Profile size after login was ~49.9 MB. Deletion/backup/ACL behavior was not tested in Phase 0.

### 5.7 Profile is sensitive data

The profile contains live Telegram session data. It is gitignored and must remain in Local AppData, ACL-restricted, excluded from cloud sync and never logged. No profile content was inspected.

## 6. Telegram Content Licensing

Telegram's current Content Licensing terms restrict using Telegram platform data for scraping, indexing, harvesting, aggregation, and for training, fine-tuning, validation, development, enhancement, benchmarking or deployment of AI/ML models, unless the stated exception for explicit, informed and ongoing consent of all relevant users applies to the specific content and context.

Phase 0 reads no message content. It checks only login state and a visible chat-item count. `AI_CONTENT_PROCESSING_ENABLED` remains `false`. `telegram_messages_read`, `telegram_message_send`, `telegram_message_reply`, `telegram_message_edit` and `telegram_message_delete` remain feature-gated/disabled, and local processing is not treated as a workaround. See `PRIVACY_AND_COMPLIANCE.md`.

## 7. Known limitations and risks

- Telegram Web DOM and selectors are not a stable third-party contract. `chatlist-chat` and `#chatlist-container` can change without notice.
- Telegram may expire or revoke a web session at any time; `LOGIN_REQUIRED` must be handled.
- Telegram Web may require additional verification, CAPTCHA, or anti-automation checks.
- The persistent Chromium profile contains sensitive session data and must remain local, ACL-protected, and excluded from Git/cloud sync.
- Browser automation is resource-heavy; lazy-start remains mandatory.
- Direct Telegram access was blocked on this network. The product needs an explicit network/proxy strategy; in-app proxy support is not in the MVP unless approved.
- Playwright browser downloads were geo-blocked without a proxy. Build/packaging must fetch and verify Chromium from an accessible source.
- The headless shell is unnecessary for a headed-only product; package with `playwright install chromium --no-shell` to save ~123 MB.
- A full Windows restart, Electron restart, Phone Login, 2FA, session revocation, and multi-account isolation remain unproven and belong to later phases.

## 8. Go / No-Go

**GO — conditional** for Phase 1.

The core premise is proven: a real account logged in through visible Telegram Web without API credentials, the session survived a browser-process restart, the chat list was readable, and the profile was locked. No private endpoint or credential was used.

Conditions before/while proceeding:

1. Pin Node 26.13.0, Electron 45.2.3, Playwright 1.65.0 and MCP SDK 1.32.2; commit lockfiles.
2. Bundle and integrity-check the matching Chromium; do not download at runtime.
3. Centralize selectors, use visibility checks, and fail closed with `TELEGRAM_UI_CHANGED`/`LOGIN_REQUIRED`.
4. Resolve the network/proxy strategy (D-006) before real-user onboarding.
5. Keep the AI/compliance gate closed; no message-content tools in the MVP.
6. Add later manual tests: Phone Login, 2FA, Windows restart, Electron restart, session revoke, three accounts.
7. Add profile ACL, backup/restore and corruption handling in hardening.

**No-Go triggers (none observed):** Telegram blocks headed automation, login requires private APIs, or the session cannot persist.

## 9. Decision updates

| ID | Decision | Status |
|---|---|---|
| D-001 | MVP targets WebZ at `/k/` (default redirect). `/a/` not evaluated. | Resolved for MVP — pending user approval |
| D-003 | Node 26.13.0 LTS, Electron 45.2.3, Playwright 1.65.0 (Chrome for Testing 158.0.8127.18), MCP SDK 1.32.2, TypeScript 5.9.3, Zod 4.6.7. | Proposed — pending user approval |
| D-006 | Network/proxy strategy: rely on OS-level VPN/proxy, or add an explicit app proxy setting. | New — open |
| D-002 | Named Pipe ACL approach. | Open (Phase 5) |
| D-004 | AI content processing / consent. | Blocked |
| D-005 | Windows 10 support. | Open (not tested) |

## 10. Reproduction

```powershell
cd spike
npm install
npx playwright install chromium
$env:SPIKE_PROXY = "http://127.0.0.1:<port>"   # only if direct access is blocked
npm run probe
npm run login      # user scans QR in the visible window
npm run verify     # new browser process, same profile
npm run locktest
npm run check
```

Evidence: `spike/logs/spike-state.jsonl`.
