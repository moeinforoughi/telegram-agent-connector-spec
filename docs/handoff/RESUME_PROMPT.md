# Resume Prompt

You are starting a new session with **no memory of previous chats**. The
repository is the only source of truth.

Before changing anything:

1. Read `AGENTS.md`.
2. Read `docs/PROJECT_STATE.md`.
3. Read `docs/handoff/LATEST_HANDOFF.md`.
4. Skim `docs/handoff/SESSION_LOG.md` (append-only history).
5. Read the active plan (`docs/phase2/PHASE2_PLAN.md` while Phase 2 is active)
   and the task files it references.
6. Inspect the real repository state:
   `git status`, `git branch --show-current`,
   `git log --graph --oneline --decorate -15`, `git diff`.
7. Compare the working tree and commits with the last handoff. If they differ,
   investigate before deleting or overwriting anything.
8. Find the first incomplete task and continue from its first unchecked step.
9. Do not reimplement committed work. Check the source and tests first.
10. Keep the state files updated at every logical checkpoint; before stopping,
    run the available tests and record the exact commands and results.
11. Do not start a later phase without explicit user approval.
12. Do not push, reset, or delete user changes.

Test commands:

```powershell
$env:PATH = "C:\Users\mforo\AppData\Local\Temp\opencode\node-v26.13.0-win-x64;" + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = "spike/.browsers"   # local Chromium for integration tests
npm run check
```

If the environment differs (no portable Node, no browsers), record the
limitation instead of skipping tests silently.
