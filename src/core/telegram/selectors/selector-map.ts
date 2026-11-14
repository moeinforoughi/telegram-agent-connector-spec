/**
 * All Telegram Web selectors live here. The DOM is not a stable contract; a
 * missing or restructured UI must produce TELEGRAM_UI_CHANGED, not guesswork.
 *
 * The Phase 4 read-only audit (2026-11-10) confirmed:
 * - Chat list: #column-left > #chatlist-container > .chatlist-chat[data-peer-id]
 * - Search: input.input-search-input; results in .search-super
 * - Open chat: #column-center .chats-container .chat.active[data-type]
 * - Header: #column-center .topbar .peer-title
 * - Messages: #column-center .bubbles .bubble[data-mid].is-in / .is-out
 * - Loading: .preloader-container.is-visible
 * - Empty search: .search-super [class*="NoResults"]
 */
export const SELECTORS = {
  activeChat: "#column-center .chat.active",
  activeChatPeer: ".topbar .peer-title[data-peer-id]",
  activeMessageList: ".bubbles",
  activeChatMessages: ".bubble[data-mid]",
  messageTextWithinRow: ".message",
  messageSenderWithinRow: ".peer-title",
  searchOutcome:
    ".search-super .chatlist-chat[data-peer-id]:visible, .search-super [class*='NoResults']:visible, .search-super [class*='no-results']:visible",
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
    "#chatlist-container .chatlist-chat[data-peer-id]",
    "#chatlist-container .chatlist-chat",
    ".chat-list .chat-item",
    ".chatlist-chat",
    "a.chat-item",
    "[data-peer-id]",
  ],
  mainShell: ["#page-chats", "#column-left", ".whole.page-chats"],
  chatListContainer: [
    "#chatlist-container",
    "#column-left .chatlist-container",
    "#column-left .chatlist-container-chats",
  ],
  chatRows: [
    "#chatlist-container .chatlist-chat[data-peer-id]",
    "#chatlist-container .chatlist-chat",
  ],
  chatRowTitle: [".dialog-title .peer-title", ".row-title .peer-title", ".peer-title"],
  chatRowPreview: [".dialog-subtitle", ".row-subtitle", ".dialog-subtitle-parts"],
  chatUnread: [".dialog-subtitle-badge-unread", ".dialog-subtitle-badge.is-visible"],
  chatRowTime: [".dialog-title-details .message-time", ".message-time"],
  searchResultRows: [".search-super .chatlist-chat[data-peer-id]", ".search-super .chatlist-chat"],
  chatPeerId: [
    "#column-center .topbar .peer-title[data-peer-id]",
    "#column-center .bubble[data-peer-id]",
  ],
  searchInput: [".input-search-input", "#search-input", "#column-left input[type='search']"],
  searchResults: [".search-super", ".search-container", "#column-left .search-super"],
  searchNoResults: [
    ".search-super [class*='NoResults']",
    ".search-super [class*='no-results']",
    "[class*='NoResults']",
  ],
  columnCenter: ["#column-center", ".main-column#column-center"],
  openChat: [
    "#column-center .chats-container .chat.active",
    "#column-center .chat.active",
    "#column-center .chat",
  ],
  chatTitle: [
    "#column-center .topbar .peer-title",
    "#column-center .chat-info .peer-title",
    "#column-center .peer-title",
  ],
  messageList: ["#column-center .bubbles", "#column-center .bubbles .bubbles-scrollable"],
  messageRows: ["#column-center .bubble[data-mid]", "#column-center .bubble"],
  messageText: ["#column-center .bubble .message", ".bubble .message"],
  messageSender: ["#column-center .bubble .peer-title", ".bubble .peer-title"],
  messageTime: ["#column-center .bubble .time", ".bubble .time"],
  outgoingMessages: ["#column-center .bubble.is-out[data-mid]", "#column-center .bubble.is-out"],
  incomingMessages: ["#column-center .bubble.is-in[data-mid]", "#column-center .bubble.is-in"],
  channelPosts: ["#column-center .bubble.channel-post", "#column-center .channel-post"],
  loading: [".preloader-container.is-visible", ".spinner", ".loading"],
  chatListLoading: [
    "#column-left .preloader-container.is-visible",
    "#chatlist-container .preloader-container.is-visible",
  ],
  emptyState: [
    ".search-super [class*='NoResults']",
    ".search-super [class*='no-results']",
    "#chatlist-container .empty",
    ".chatlist-empty",
  ],
} as const;
