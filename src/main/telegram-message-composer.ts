import type { Locator, Page } from "playwright";
import { SELECTORS } from "../core/telegram/selectors/selector-map";
import { AppError } from "../shared/errors";
import type { PreparedMessage } from "../shared/messaging";

export function activePeer(page: Page, chatId: string): Locator {
  return page.locator(SELECTORS.activeChat).filter({
    has: page.locator(`${SELECTORS.activeChatPeer}[data-peer-id="${chatId}"]`),
  });
}

export async function replyTarget(chat: Locator, messageId: string, timeout: number) {
  const row = chat.locator(
    `${SELECTORS.activeChatMessages}[data-mid="${messageId}"]${SELECTORS.settledMessage}:visible`,
  );
  if ((await row.count()) !== 1) {
    throw new AppError("MESSAGE_NOT_FOUND", "The requested message is not visible in this chat");
  }
  const text = (await row.locator(SELECTORS.messageTextWithinRow).innerText({ timeout })).trim();
  if (!text) throw new AppError("UNSUPPORTED_OPERATION", "Reply requires a visible text message");
  return { row, text };
}

export async function submitThroughComposer(
  page: Page,
  operation: PreparedMessage,
  signal: AbortSignal,
  timeout: number,
  submissionState: (possible: boolean) => void,
  deadline: number,
): Promise<string> {
  const chatId = operation.recipient.id;
  const chat = activePeer(page, chatId);
  const input = chat.locator(SELECTORS.composer);
  const control = chat.locator(SELECTORS.sendControl);
  const uiChanged = () =>
    new AppError("TELEGRAM_UI_CHANGED", "Telegram composer or destination could not be verified");
  if (
    (await chat.count()) !== 1 ||
    (await input.count()) !== 1 ||
    (await control.count()) !== 1 ||
    !(await input.isVisible()) ||
    !(await control.isVisible()) ||
    (await input.innerText({ timeout })).trim() ||
    (await chat.evaluate(
      (element, selector) => element.matches(selector),
      SELECTORS.activeInputHelper,
      { timeout },
    ))
  ) {
    throw uiChanged();
  }
  const replyId = operation.kind === "reply" ? operation.messageId : undefined;
  let replyText: string | undefined;
  if (operation.kind === "reply") {
    const target = await replyTarget(chat, operation.messageId, timeout);
    if (target.text.slice(0, 240) !== operation.targetPreview) throw uiChanged();
    replyText = target.text;
    const menu = page.locator(SELECTORS.replyMenuAction);
    if (await menu.count()) throw uiChanged();
    await target.row.click({ button: "right", timeout });
    await menu.click({ timeout });
    await chat.locator(SELECTORS.replyHelper).waitFor({ state: "visible", timeout });
    if (
      (await chat.locator(SELECTORS.replyHelperText).innerText({ timeout })).trim() !== replyText
    ) {
      throw uiChanged();
    }
  }
  if (signal.aborted || Date.now() >= operation.expiresAt)
    throw new AppError("PERMISSION_DENIED", "Confirmation expired before submission");
  const editor = await input.elementHandle({ timeout });
  try {
    await editor.fill(operation.text, { timeout });
    await chat
      .locator(`${SELECTORS.sendControl}${SELECTORS.plainSendControl}`)
      .waitFor({ state: "visible", timeout });
    if (signal.aborted || Date.now() >= operation.expiresAt)
      throw new AppError("PERMISSION_DENIED", "Confirmation expired before submission");
    const expiresAt = Math.min(operation.expiresAt, deadline);
    const text = operation.text;
    submissionState(true);
    // Check the same editor, peer, mode and text in the DOM turn that clicks.
    const previous = await editor.evaluate(
      (node, args) => {
        const { selectors: s } = args;
        const active = document.querySelectorAll(s.activeChat);
        const chat = active.length === 1 ? active[0] : undefined;
        const peers = chat?.querySelectorAll(s.activeChatPeer);
        const buttons = chat?.querySelectorAll<HTMLElement>(s.sendControl);
        const button = buttons?.[0];
        if (
          Date.now() >= args.expiresAt ||
          !chat ||
          !chat.contains(node) ||
          peers?.length !== 1 ||
          peers[0]?.getAttribute("data-peer-id") !== args.chatId ||
          !button ||
          buttons?.length !== 1 ||
          !button.matches(s.plainSendControl) ||
          !button.getClientRects().length ||
          Array.from(chat.querySelectorAll(s.sendModifiers)).some(
            (element) => element.getClientRects().length > 0,
          ) ||
          !(node instanceof HTMLElement) ||
          node.innerText !== args.text
        )
          return null;
        if (args.replyId !== undefined) {
          const replies = chat.querySelectorAll(s.replyHelper);
          const targets = Array.from(chat.querySelectorAll(s.activeChatMessages)).filter(
            (row) =>
              row.matches(s.settledMessage) &&
              row.querySelector<HTMLElement>(s.messageTextWithinRow)?.innerText.trim() ===
                args.replyText,
          );
          if (
            !chat.matches(s.activeInputHelper) ||
            replies.length !== 1 ||
            chat.querySelector<HTMLElement>(s.replyHelperText)?.innerText.trim() !==
              args.replyText ||
            targets.length !== 1 ||
            targets[0]?.getAttribute("data-mid") !== args.replyId
          )
            return null;
        } else if (chat.matches(s.activeInputHelper)) return null;
        const existing = Array.from(chat.querySelectorAll(s.activeChatMessages), (row) =>
          row.getAttribute("data-mid"),
        );
        button.click();
        return existing;
      },
      { selectors: SELECTORS, chatId, text, replyId, replyText, expiresAt },
    );
    if (!previous) {
      submissionState(false);
      throw uiChanged();
    }
    const result = await page.waitForFunction(
      ({ s, chatId, text, replyId, previous }) => {
        const active = document.querySelectorAll(s.activeChat);
        const chat = active.length === 1 ? active[0] : undefined;
        const peers = chat?.querySelectorAll(s.activeChatPeer);
        if (peers?.length !== 1 || peers[0]?.getAttribute("data-peer-id") !== chatId) return false;
        const rows = Array.from(chat?.querySelectorAll(s.acknowledgedOutgoing) ?? []);
        const matches = rows.filter((row) => {
          const id = row.getAttribute("data-mid");
          return (
            id !== null &&
            /^[1-9]\d{0,19}$/.test(id) &&
            !previous.includes(id) &&
            row.querySelector<HTMLElement>(s.messageTextWithinRow)?.innerText === text &&
            (replyId === undefined
              ? !row.hasAttribute("data-reply-to-mid") &&
                !row.hasAttribute("data-reply-to-story-id")
              : row.getAttribute("data-reply-to-mid") === replyId &&
                row.getAttribute("data-reply-to-peer-id") === chatId)
          );
        });
        return matches.length === 1 ? matches[0]?.getAttribute("data-mid") : false;
      },
      { s: SELECTORS, chatId, text, replyId, previous },
      { timeout },
    );
    try {
      return (await result.jsonValue()) as string;
    } finally {
      await result.dispose().catch(() => undefined);
    }
  } finally {
    await editor.dispose().catch(() => undefined);
  }
}
