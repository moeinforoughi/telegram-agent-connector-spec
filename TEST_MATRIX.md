# Test Matrix and Acceptance Tests

## A. Account & Login
| ID | سناریو | انتظار |
|---|---|---|
| ACC-001 | Add Account | UUID و Profile مستقل ساخته شود |
| ACC-002 | Open Login | Telegram Web در Browser قابل مشاهده باز شود |
| ACC-003 | QR Login | پس از ورود، State برابر CONNECTED شود |
| ACC-004 | Phone Login | کاربر در خود Telegram Web وارد کند |
| ACC-005 | Two-Step | رمز در اختیار Agent یا Log قرار نگیرد |
| ACC-006 | Wrong/Expired Code | خطای قابل فهم؛ بدون ذخیره credential |
| ACC-007 | Restart App | Profile حفظ شود |
| ACC-008 | Restart Windows | Session در صورت معتبر بودن حفظ شود |
| ACC-009 | Revoke Session | LOGIN_REQUIRED تشخیص داده شود |
| ACC-010 | Remove Account | حذف Profile فقط با تأیید کاربر |

## B. Multi-account
| ID | سناریو | انتظار |
|---|---|---|
| MUL-001 | Add 3 accounts | سه Profile مستقل |
| MUL-002 | Open same profile twice | PROFILE_LOCKED |
| MUL-003 | Logout account A | B و C سالم بمانند |
| MUL-004 | Remove account B | A و C تحت تأثیر نباشند |
| MUL-005 | Concurrent calls same account | اجرای سریالی |
| MUL-006 | Calls different accounts | بدون اشتراک Session |

## C. Browser & Telegram Web
| ID | سناریو | انتظار |
|---|---|---|
| WEB-001 | Browser crash | State به خطا برود و Recovery کنترل‌شده |
| WEB-002 | Network offline | Timeout و خطای مشخص |
| WEB-003 | Unknown page | عملیات متوقف شود |
| WEB-004 | Selector changed | TELEGRAM_UI_CHANGED |
| WEB-005 | Login page unexpectedly | Tool متوقف و LOGIN_REQUIRED |
| WEB-006 | Browser closed by user | BROWSER_CLOSED |
| WEB-007 | Profile corrupt | عدم حذف خودکار؛ گزارش و گزینه Recovery |

## D. MCP
| ID | سناریو | انتظار |
|---|---|---|
| MCP-001 | Start MCP Bridge | STDIO handshake موفق |
| MCP-002 | Core not running | CONNECTOR_NOT_RUNNING |
| MCP-003 | Invalid account_id | Validation error |
| MCP-004 | Unknown tool | استاندارد MCP error |
| MCP-005 | Oversized input | رد درخواست |
| MCP-006 | stdout logs | هیچ Log غیرپروتکلی در stdout |
| MCP-007 | Pipe unavailable | خطای قابل فهم |
| MCP-008 | Concurrent clients | Core واحد و Queue امن |
| MCP-009 | Tool output limit | خروجی در سقف تعریف‌شده |

## E. Security & Privacy
| ID | سناریو | انتظار |
|---|---|---|
| SEC-001 | Search logs for code/password | هیچ نتیجه‌ای |
| SEC-002 | Search logs for cookie/session | هیچ نتیجه‌ای |
| SEC-003 | Renderer tries Node access | دسترسی مسدود |
| SEC-004 | Path traversal account id | رد درخواست |
| SEC-005 | Unauthorized pipe client | رد اتصال |
| SEC-006 | Prompt injection message fixture | Permission تغییر نکند |
| SEC-007 | AI content tool while gate off | COMPLIANCE_GATE_BLOCKED |
| SEC-008 | Delete operation without confirmation | رد درخواست |

## F. Packaging
| ID | سناریو | انتظار |
|---|---|---|
| PKG-001 | Install on clean Windows 11 | نصب موفق بدون Node/Docker |
| PKG-002 | First launch | Browser resources موجود |
| PKG-003 | Uninstall keep data | Profile حفظ شود |
| PKG-004 | Uninstall delete data | تأیید صریح و حذف کامل |
| PKG-005 | Upgrade | Profile حفظ شود |
| PKG-006 | MCP config setup | فقط تنظیم مربوط اضافه شود |
| PKG-007 | Existing MCP config | تنظیمات قبلی حفظ شوند |
| PKG-008 | Missing Codex | خطای قابل فهم، برنامه سالم |
| PKG-009 | App path spaces/non-ASCII | MCP اجرا شود |
| PKG-010 | App without Admin | عملکرد عادی |

## Release Acceptance
- تمام P0 تست‌ها Pass.
- نصب روی Windows تمیز تست شده باشد.
- QR Login دستی با حساب آزمایشی موفق باشد.
- Session پس از Restart حفظ شود.
- سه اکانت مستقل تست شوند.
- MCP به حداقل یک Client متصل شود.
- هیچ `api_id`, `api_hash` یا Bot Token لازم نباشد.
- Logها هیچ محتوای حساس نداشته باشند.
- محدودیت AI Content Processing در UI و Docs نمایش داده شود.
