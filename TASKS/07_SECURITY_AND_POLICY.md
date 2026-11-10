# TASK 07 — Security, Policy & Audit

Priority: P0 | Depends on: TASK 03, TASK 04, TASK 06 | Commit: `feat(security): add local policy and audit controls`

## Work Items
- [ ] Permission Engine ساده.
- [ ] Default-deny برای عملیات ناشناخته.
- [ ] Risk classification.
- [ ] تأیید UI برای عملیات حساس.
- [ ] Audit JSONL.
- [ ] Redaction مرکزی.
- [ ] عدم ثبت پیام/Session.
- [ ] IPC allowlist.
- [ ] Local file permissions.
- [ ] Prompt Injection boundaries.
- [ ] Compliance Gate برای AI content.
- [ ] No bulk messaging.
- [ ] No hidden background polling.

## Tests
- [ ] Unknown action denied.
- [ ] Destructive action requires confirmation.
- [ ] Message content cannot change policy.
- [ ] Secret redaction.
- [ ] Log size rotation.
- [ ] Content tools blocked by default.
- [ ] No arbitrary browser script tool.

## Acceptance
هیچ Tool ناشناخته یا ورودی پیام نمی‌تواند Policy یا دسترسی را افزایش دهد.
