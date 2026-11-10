import { useEffect, useState } from "react";
import { APP_NAME } from "../../shared/constants";
import type { AppInfo } from "../../shared/types";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly info: AppInfo }
  | { readonly status: "error"; readonly message: string };

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    if (!window.api) {
      setState({ status: "error", message: "Preload API is unavailable." });
      return () => {
        active = false;
      };
    }

    window.api
      .getAppInfo()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setState({ status: "ready", info: result.data });
        } else {
          setState({ status: "error", message: result.error.message });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error", message: "Failed to load application information." });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Phase 1 · Repository Foundation</p>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">
          Local Windows connector. Unofficial and not affiliated with Telegram.
        </p>
      </header>

      <section className="card" aria-labelledby="status-heading">
        <h2 id="status-heading">Runtime status</h2>
        {state.status === "loading" ? <p>Loading…</p> : null}
        {state.status === "error" ? <p className="error">{state.message}</p> : null}
        {state.status === "ready" ? (
          <dl>
            <div>
              <dt>App version</dt>
              <dd>{state.info.appVersion}</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>{state.info.platform}</dd>
            </div>
            <div>
              <dt>Data storage</dt>
              <dd>Local application data</dd>
            </div>
            <div>
              <dt>Renderer isolation</dt>
              <dd>Enabled</dd>
            </div>
          </dl>
        ) : null}
      </section>

      <footer>
        Accounts, browser automation and MCP are intentionally not part of this phase.
      </footer>
    </main>
  );
}
