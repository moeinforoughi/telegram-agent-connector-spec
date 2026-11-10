import { describe, expect, it } from "vitest";
import { secureWebPreferences } from "../../src/main/window-options";

describe("secureWebPreferences", () => {
  it("enables isolation and disables Node in the renderer", () => {
    const preferences = secureWebPreferences("C:\\preload.js");

    expect(preferences.preload).toBe("C:\\preload.js");
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.sandbox).toBe(true);
    expect(preferences.webSecurity).toBe(true);
    expect(preferences.webviewTag).toBe(false);
    expect(preferences.allowRunningInsecureContent).toBe(false);
  });
});
