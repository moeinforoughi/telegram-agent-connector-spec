import path from "node:path";
import { app, BrowserWindow, type WebContents } from "electron";
import { isAllowedDevServerUrl } from "./dev-server";
import { secureWebPreferences } from "./window-options";

function blockUnexpectedNavigation(
  contents: WebContents,
  details: { url: string; preventDefault: () => void },
): void {
  const currentUrl = contents.getURL();
  if (currentUrl && details.url !== currentUrl) {
    details.preventDefault();
  }
}

export function createMainWindow(preloadPath: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: secureWebPreferences(preloadPath),
  });

  window.once("ready-to-show", () => window.show());

  const session = window.webContents.session;
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-frame-navigate", (details) =>
    blockUnexpectedNavigation(window.webContents, details),
  );
  window.webContents.on("will-redirect", (details) =>
    blockUnexpectedNavigation(window.webContents, details),
  );

  return window;
}

export async function loadRenderer(window: BrowserWindow): Promise<void> {
  const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl && isAllowedDevServerUrl(devServerUrl)) {
    await window.loadURL(devServerUrl);
    return;
  }
  if (devServerUrl) {
    console.error("[main] ignored an invalid ELECTRON_RENDERER_URL");
  }
  await window.loadFile(path.join(__dirname, "../renderer/index.html"));
}
