export function isAllowedDevServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return (url.protocol === "http:" || url.protocol === "https:") && localHosts.has(url.hostname);
  } catch {
    return false;
  }
}
