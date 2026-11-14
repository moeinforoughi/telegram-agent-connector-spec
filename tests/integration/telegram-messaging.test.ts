import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TelegramReadAdapter } from "../../src/main/telegram-read-adapter";
import type { PreparedMessage } from "../../src/shared/messaging";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const operation = {
  status: "prepared",
  confirmationRequired: true,
  kind: "send",
  accountId: "account",
  accountLabel: "Fixture",
  recipient: { id: "101", title: "Test", type: "user" },
  operationId: "test-operation",
  expiresAt: Number.MAX_SAFE_INTEGER,
  text: "Synthetic message",
} as const satisfies PreparedMessage;

async function fixture(acknowledge = true): Promise<{ page: Page; adapter: TelegramReadAdapter }> {
  const page = await browser.newPage();
  await page.setContent(`
    <div id="page-chats"><div id="column-center"><div class="chat active" data-type="chat">
      <div class="topbar"><span class="peer-title" data-peer-id="101">Test</span></div>
      <div class="bubbles"><div class="bubble is-in" data-mid="5"><div class="message">Original</div></div></div>
      <div class="chat-input">
        <div class="input-message-input" contenteditable="true"></div>
        <button class="btn-send record">Action</button>
      </div>
    </div></div></div>
    <script>
      const chat = document.querySelector('.chat');
      const input = document.querySelector('[contenteditable]');
      const button = document.querySelector('.btn-send');
      let target;
      input.addEventListener('input', () => button.classList.toggle('send', !!input.textContent));
      document.querySelector('.bubble').addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const menu = document.createElement('div');
        menu.className = 'btn-menu active';
        menu.innerHTML = '<button class="btn-menu-item"><span class="btn-menu-item-icon tgico-reply"></span>Reply</button>';
        menu.firstElementChild.onclick = () => {
          target = event.currentTarget?.dataset.mid || '5';
          chat.classList.add('is-helper-active');
          const helper = document.createElement('div');
          helper.className = 'reply-wrapper';
          helper.innerHTML = '<button class="reply-icon reply">Reply</button><div class="reply-subtitle">Original</div>';
          document.querySelector('.chat-input').prepend(helper);
          menu.remove();
        };
        document.body.append(menu);
      });
      button.onclick = () => {
        button.dataset.clicks = String(Number(button.dataset.clicks || 0) + 1);
        const row = document.createElement('div');
        row.className = 'bubble is-out ' + (${acknowledge} ? 'is-sent' : 'is-sending');
        row.dataset.mid = '42';
        if (target) { row.dataset.replyToMid = target; row.dataset.replyToPeerId = '101'; }
        const body = document.createElement('div');
        body.className = 'message';
        body.textContent = input.innerText;
        row.append(body);
        document.querySelector('.bubbles').append(row);
        input.textContent = '';
      };
    </script>
  `);
  return {
    page,
    adapter: new TelegramReadAdapter({ pageSource: () => page, loadingTimeoutMs: 500 }),
  };
}

describe("Telegram messaging fixtures", () => {
  it("accepts a different header title only for a self recipient with the same active peer", async () => {
    const { page, adapter } = await fixture();
    const self = {
      ...operation,
      recipient: { id: "101", title: "Saved Messages", type: "self", isSelfChat: true },
    } as const;
    try {
      await page.locator(".topbar .peer-title").evaluate((header) => {
        header.textContent = "Account display name";
        header.setAttribute("data-peer-id", "999");
      });
      await expect(adapter.submitMessage(self)).rejects.toMatchObject({ code: "CHAT_NOT_FOUND" });
      expect(await page.locator(".btn-send").getAttribute("data-clicks")).toBeNull();
      await page
        .locator(".topbar .peer-title")
        .evaluate((header) => header.setAttribute("data-peer-id", "101"));
      await expect(adapter.submitMessage(self)).resolves.toBe("42");
    } finally {
      await page.close();
    }
  });
  it("submits text once and verifies a new acknowledged outgoing message", async () => {
    const { page, adapter } = await fixture();
    try {
      await expect(adapter.submitMessage(operation)).resolves.toBe("42");
      expect(await page.locator(".btn-send").getAttribute("data-clicks")).toBe("1");
    } finally {
      await page.close();
    }
  });

  it("requires the exact visible reply target and verifies the outgoing reply relation", async () => {
    const { page, adapter } = await fixture();
    try {
      await expect(adapter.inspectReply("account", "101", "6")).rejects.toMatchObject({
        code: "MESSAGE_NOT_FOUND",
      });
      const target = await adapter.inspectReply("account", "101", "5");
      await expect(
        adapter.submitMessage({
          ...operation,
          kind: "reply",
          messageId: "5",
          targetPreview: target.targetPreview,
        }),
      ).resolves.toBe("42");
    } finally {
      await page.close();
    }
  });

  it("preserves existing drafts and fails closed before submission", async () => {
    const { page, adapter } = await fixture();
    try {
      await page.locator("[contenteditable]").fill("Existing draft");
      await expect(adapter.submitMessage(operation)).rejects.toMatchObject({
        code: "TELEGRAM_UI_CHANGED",
      });
      expect(await page.locator("[contenteditable]").textContent()).toBe("Existing draft");
      expect(await page.locator(".btn-send").getAttribute("data-clicks")).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("reports an unacknowledged bubble as unknown without clicking again", async () => {
    const { page, adapter } = await fixture(false);
    try {
      await expect(adapter.submitMessage(operation)).rejects.toMatchObject({
        code: "OUTCOME_UNKNOWN",
      });
      expect(await page.locator(".btn-send").getAttribute("data-clicks")).toBe("1");
    } finally {
      await page.close();
    }
  });

  it("rejects the wrong active peer and unknown composer controls before clicking", async () => {
    const { page, adapter } = await fixture();
    try {
      await expect(adapter.inspectReply("account", "102", "5")).rejects.toMatchObject({
        code: "CHAT_NOT_FOUND",
      });
      await page.locator(".btn-send").evaluate((button) => button.classList.remove("btn-send"));
      await expect(adapter.submitMessage(operation)).rejects.toMatchObject({
        code: "TELEGRAM_UI_CHANGED",
      });
      expect(await page.locator("button").getAttribute("data-clicks")).toBeNull();
    } finally {
      await page.close();
    }
  });

  it("reports an unknown outcome if the browser page closes after submission", async () => {
    const { page, adapter } = await fixture(false);
    try {
      const closing = page
        .waitForFunction(() => document.querySelector(".is-sending") !== null)
        .then(() => page.close());
      await expect(adapter.submitMessage(operation)).rejects.toMatchObject({
        code: "OUTCOME_UNKNOWN",
      });
      await closing;
      await expect(adapter.submitMessage(operation)).rejects.toMatchObject({
        code: "BROWSER_CLOSED",
      });
    } finally {
      await page.close();
    }
  });
});
