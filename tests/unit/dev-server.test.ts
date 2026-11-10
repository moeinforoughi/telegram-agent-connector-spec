import { describe, expect, it } from "vitest";
import { isAllowedDevServerUrl } from "../../src/main/dev-server";

describe("isAllowedDevServerUrl", () => {
  it("accepts local HTTP/HTTPS development URLs", () => {
    expect(isAllowedDevServerUrl("http://localhost:5173/")).toBe(true);
    expect(isAllowedDevServerUrl("http://127.0.0.1:5173/")).toBe(true);
    expect(isAllowedDevServerUrl("https://localhost:5173/")).toBe(true);
    expect(isAllowedDevServerUrl("http://[::1]:5173/")).toBe(true);
  });

  it("rejects remote, non-HTTP and invalid URLs", () => {
    expect(isAllowedDevServerUrl("https://example.com/")).toBe(false);
    expect(isAllowedDevServerUrl("file:///C:/app/index.html")).toBe(false);
    expect(isAllowedDevServerUrl("data:text/html,hi")).toBe(false);
    expect(isAllowedDevServerUrl("not a url")).toBe(false);
  });
});
