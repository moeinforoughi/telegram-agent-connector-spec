# Resume Prompt

You are starting a new session with **no memory of previous chats**. The
repository is the only source of truth.

Before changing anything:

1. Read `AGENTS.md` (including the permanent Session-Independent Development
   rules).
2. Read `docs/PROJECT_STATE.md`.
3. Read `docs/handoff/LATEST_HANDOFF.md`.
4. Skim `docs/handoff/SESSION_LOG.md` (append-only history).
5. Read `docs/architecture/IMPLEMENTED_ARCHITECTURE.md` (what is really built)
   and `docs/phase2/PHASE2_REPORT.md` (verification status and the pending live
   checklist).
6. Read the active plan (`docs/phase2/PHASE2_PLAN.md` while Phase 2 is active)
   and the task files it references.
7. Inspect the real repository state:
   `git status`, `git branch --show-current`,
   `git log --graph --oneline --decorate -20`, `git diff`,
   `git ls-files --others --exclude-standard`.
8. Compare the working tree and commits with the last handoff. If they differ,
   investigate before deleting or overwriting anything.
9. Do not reimplement committed work. Check the source and tests first.
10. Keep the state files updated at every logical checkpoint; before stopping,
    run the available tests and record the exact commands and results.
11. Do not start a later phase without explicit user approval.
12. Do not push, reset, or delete user changes.
13. Never keep an important decision, limitation, or test result only in chat.
    Put it in the repository.

## Current state (2026-11-10)

**Phase 2 is COMPLETE FOR MVP** with accepted deferred verifications.
**Phase 3 is COMPLETE FOR MVP**: two real accounts (`moein1`, `kaonashi`) logged
in through SOCKS5 `127.0.0.1:12334`, both browsers were closed, and both
profiles/sessions were preserved for Phase 4. A third live account was not tested
(accepted). Normal browser close now shows `Ready` with last-known login, not an
error.

**Phase 4 — Telegram Operations is planned only, not started.** Read
`docs/phase4/PHASE4_PLAN.md`; implementation requires explicit user approval and
starts read-only. Never send/edit/delete a real message without explicit
approval. MCP remains Phase 5.

**Critical:** never delete, reset, logout, or remove the two existing account
profiles/sessions; never extract cookies/tokens or commit profile data. Phase 4
tests use these preserved sessions.

Do not re-run Phase 2 deferred tests unless asked. Phase 4/5 is not authorized.

Proxy rules (permanent): the connector uses only the user's saved manual proxy
(SOCKS5/HTTP, host, port, optional credentials). There is no system-proxy
detection and no silent fallback. The Enable toggle persists immediately; the
controller logs the stored proxy metadata (never credentials) and fails closed
if enabled but unusable. Credentials are OS-encrypted (async safeStorage) or not
stored. Do not reintroduce `windows-proxy`-style detection; see ADR-020/021.

## Test commands

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"   # local Chromium for integration tests
npm run check
```

`npm run check` strips `ELECTRON_RUN_AS_NODE` for its Electron E2E child
process, so it passes even when the DSH shell exports `ELECTRON_RUN_AS_NODE=1`.
For interactive `npm run dev` / `npm start`, unset it in that shell first
(`Remove-Item Env:ELECTRON_RUN_AS_NODE`), otherwise Electron boots as plain Node
and fails with `bad option: --remote-debugging-port=0`. Never change the
Windows User/Machine environment for this.

If the environment differs (no portable Node, no browsers), record the
limitation instead of skipping tests silently.
