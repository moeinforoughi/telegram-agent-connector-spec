import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import type { Plugin } from "vite";

/**
 * Inject a CSP meta tag at build/dev time. Dev needs inline/eval allowances for
 * Vite's React refresh preamble and HMR socket; production stays strict.
 */
function cspPlugin(): Plugin {
  return {
    name: "inject-csp",
    transformIndexHtml(html, context) {
      const isDev = Boolean(context.server);
      const policy = isDev
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data:; object-src 'none'; base-uri 'none'"
        : "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'";

      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), cspPlugin()],
    build: {
      minify: true,
      target: "chrome156",
    },
  },
});
