/**
 * All Telegram Web selectors live here. The DOM is not a stable contract; a
 * missing or restructured UI must produce TELEGRAM_UI_CHANGED, not guesswork.
 */
export const SELECTORS = {
  authPage: ["#auth-pages", ".auth-pages", ".auth-pages-wrapper", ".page-auth"],
  qr: [
    "#auth-pages canvas",
    ".qr-container canvas",
    ".auth-qr",
    "[data-testid='qr-canvas']",
    ".qr-code",
  ],
  chatList: [
    "#column-left",
    ".chat-list",
    ".chatlist",
    "#chatlist-container",
    ".chat-list-container",
    "[data-testid='chat-list']",
  ],
  chatItems: [
    "#chatlist-container .chatlist-chat",
    "#chatlist-container li",
    ".chat-list .chat-item",
    ".chatlist-chat",
    "a.chat-item",
    "[data-peer-id]",
  ],
} as const;
