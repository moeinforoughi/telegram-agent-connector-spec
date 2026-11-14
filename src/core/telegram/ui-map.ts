import type { UiHealth, UiRouteName, UiRouteStatus } from "../../shared/telegram";
import { SELECTORS } from "./selectors/selector-map";
import type { TelegramDomProbe } from "./chat-surface";

export type { UiHealth, UiRouteName, UiRouteStatus };

export type UiRoute = {
  readonly name: UiRouteName;
  readonly surface: string;
  readonly selectors: readonly string[];
  readonly expectedState: string;
  readonly failureCondition: string;
  /** Always expected on a connected account. Others are contextual. */
  readonly required: boolean;
};

/**
 * Small, explicit map of the routes the connector operates on. This is not a
 * general Telegram scanner: unlisted surfaces are deliberately unsupported, and
 * an unrecognized structure fails closed.
 *
 * The message composer is intentionally absent: no write operation exists and
 * its DOM was never audited, so it must not be guessed.
 */
export const UI_ROUTES: readonly UiRoute[] = [
  {
    name: "main",
    surface: "Telegram WebZ application shell",
    selectors: SELECTORS.mainShell,
    expectedState: "logged in, chat area visible",
    failureCondition: "login page visible or unknown structure",
    required: true,
  },
  {
    name: "chatList",
    surface: "left column chat list",
    selectors: SELECTORS.chatListContainer,
    expectedState: "chat list container visible",
    failureCondition: "container missing after the shell is ready",
    required: true,
  },
  {
    name: "search",
    surface: "chat search panel",
    selectors: SELECTORS.searchInput,
    expectedState: "search input visible",
    failureCondition: "input missing while a search is requested",
    required: false,
  },
  {
    name: "openChat",
    surface: "center column open chat",
    selectors: SELECTORS.openChat,
    expectedState: "one chat active with a header",
    failureCondition: "no chat open or header missing",
    required: false,
  },
  {
    name: "messageList",
    surface: "open chat message list",
    selectors: SELECTORS.messageList,
    expectedState: "bubble list visible for the open chat",
    failureCondition: "message list missing while messages are requested",
    required: false,
  },
];

async function anyVisible(probe: TelegramDomProbe, selectors: readonly string[]): Promise<boolean> {
  for (const selector of selectors) {
    if (await probe.isVisible(selector)) return true;
  }
  return false;
}

/** Login page or an unknown shell: no route is trusted, so the caller must stop. */
export async function checkUiHealth(probe: TelegramDomProbe): Promise<UiHealth> {
  if (await anyVisible(probe, SELECTORS.authPage)) {
    return {
      status: "login_required",
      routes: UI_ROUTES.map((route) => ({ name: route.name, status: "missing" as const })),
    };
  }
  if (!(await anyVisible(probe, SELECTORS.mainShell))) {
    return {
      status: "ui_changed",
      routes: UI_ROUTES.map((route) => ({ name: route.name, status: "missing" as const })),
    };
  }

  const routes: { name: UiRouteName; status: UiRouteStatus }[] = [];
  for (const route of UI_ROUTES) {
    const visible = await anyVisible(probe, route.selectors);
    routes.push({
      name: route.name,
      status: visible ? "ok" : route.required ? "missing" : "not_applicable",
    });
  }

  const requiredMissing = routes.some((route) => route.status === "missing");
  return requiredMissing ? { status: "ui_changed", routes } : { status: "ready", routes };
}
