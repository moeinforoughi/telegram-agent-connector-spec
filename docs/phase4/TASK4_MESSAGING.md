# Phase 4 Task 4 — Confirmed Telegram text messaging

Baseline on main at 8c2fc1b was clean. npm run check passed with 164 unit,
33 Chromium integration and 14 Electron E2E tests before implementation.

TelegramService owns four operations for preparing send/reply and confirming or
cancelling the immutable result. The renderer displays the compact preparation.
Main displays a native confirmation with the account, peer, exact text and
reply ID. A trusted IPC sender can request that dialog. IPC never accepts the
sender's claim of approval. The affirmative dialog response consumes a
60-second, process-local operation bound to the original browser page.
Preparing a replacement supersedes the previous operation on that account.

Send uses current results from RecipientResolver. Ambiguous searches require
a fresh explicit selection. At execution the shared account queue opens the
verified row when needed and checks the active header against the approved ID
and title. A peer visible only in search may need to be opened manually first.
Reply preparation inspects an already-open chat without navigating or changing
its composer. The exact visible settled message ID and text preview are shown.
The adapter uses that row's Reply menu and checks the displayed reply helper
and a unique matching target before clicking.

| Surface | Required evidence | Failure |
|---|---|---|
| Active chat | Unique active chat, matching peer and title | Stop before submit |
| Composer | Visible editable plain-text input, empty draft, no existing helper | Stop before overwriting the draft |
| Reply | Exact visible settled row, Reply menu and matching helper | Stop on missing or ambiguous target |
| Send | Plain enabled send mode, same editor, peer and text, no visible paid/ephemeral state | Stop before click |
| Outgoing | New stable ID, outgoing acknowledged bubble, exact text, and reply peer/ID when applicable | Return OUTCOME_UNKNOWN |

The peer, editor and send mode are checked in the DOM turn that clicks. The
account queue prevents overlap and quarantines a timed-out page. No uncertain
submission is automatically retried. If staging fails, the Telegram composer
may retain the staged text or reply helper for the user to inspect.

Selectors are centralized in selector-map.ts. The public WebZ source informed
the [composer](https://github.com/morethanwords/tweb/blob/master/src/components/chat/input.ts),
[context menu](https://github.com/morethanwords/tweb/blob/master/src/components/chat/contextMenu.ts),
and [outgoing/reply attributes](https://github.com/morethanwords/tweb/blob/master/src/components/chat/bubbles.ts).
Chromium fixtures exercise those DOM contracts. The deployed UI, localized or
nonmatching reply helper text, search-only peers and message acknowledgement
remain subject to live verification. Browser/proxy configuration and both
preserved Telegram profiles were untouched.

## Automated verification

npm run check passed typecheck, lint, formatting and production build.
173 unit, 39 Chromium integration and 15 Electron E2E tests passed.
The Electron messaging flow used a temporary profile, intercepted the browser
navigation and mocked the native dialog response. Integration tests verified
send/reply acknowledgement, existing draft preservation, missing message and
composer handling, and an unknown outcome after page closure.
