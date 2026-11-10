# TASK 04 — Multi-account Manager

Priority: P1 | Depends on: TASK 03 | Commit: `feat(accounts): support isolated account profiles`

## Objective
مدیریت چند اکانت با Profileهای مستقل.

## Work Items
- [ ] Account Registry در JSON.
- [ ] Create/Update/Remove account.
- [ ] UUID ثابت.
- [ ] Label قابل ویرایش.
- [ ] Profile path از Account ID ساخته شود؛ نه ورودی آزاد کاربر.
- [ ] Lazy browser launch.
- [ ] یک Browser Context برای هر Profile.
- [ ] Per-account queue.
- [ ] Max active browser limit.
- [ ] حذف Profile فقط با تأیید و گزینه واضح.
- [ ] State recovery.

## Tests
- [ ] ساخت سه اکانت.
- [ ] استقلال Profileها.
- [ ] Lock هر Profile.
- [ ] Logout یک اکانت بدون اثر روی بقیه.
- [ ] Remove account.
- [ ] Corrupt registry recovery.
- [ ] Path traversal prevention.
- [ ] Concurrent same-account calls serialize.

## Acceptance
حداقل سه اکانت مستقل مدیریت شوند؛ هیچ Cookie/Storage مشترک نباشد.
