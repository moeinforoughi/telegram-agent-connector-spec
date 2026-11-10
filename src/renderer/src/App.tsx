import { useCallback, useEffect, useState } from "react";
import type { AccountStatus, AccountView } from "../../shared/account";
import { APP_NAME } from "../../shared/constants";
import type { IpcResult } from "../../shared/ipc";
import type { AppInfo } from "../../shared/types";

const EMPTY_VIEW: AccountView = { id: null, label: "No account", status: "disconnected" };

const STATUS_LABELS: Record<AccountStatus, string> = {
  disconnected: "Disconnected",
  initializing: "Starting browser",
  waiting_for_login: "Waiting for login",
  authenticating: "Completing sign-in",
  connected: "Connected",
  error: "Error",
};

const LOGIN_LABELS = {
  LOGIN_REQUIRED: "Waiting for QR / login",
  AUTHENTICATING: "Completing sign-in",
  CONNECTED: "Connected",
  UNKNOWN: "Checking…",
} as const;

function browserOpen(view: AccountView): boolean {
  return ["initializing", "waiting_for_login", "authenticating", "connected"].includes(view.status);
}

export function App() {
  const [view, setView] = useState<AccountView>(EMPTY_VIEW);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.api) {
      setFailure("Preload API is unavailable.");
      return;
    }

    let active = true;
    window.api.getAppInfo().then((result) => {
      if (active && result.ok) setInfo(result.data);
    });
    window.api.getAccount().then((result) => {
      if (!active) return;
      if (result.ok) setView(result.data);
      else setFailure(result.error.message);
    });
    const unsubscribe = window.api.onAccountStatus((next) => {
      if (active) setView(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = useCallback(async (action: () => Promise<IpcResult<AccountView>>) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await action();
      if (result.ok) setView(result.data);
      else setFailure(result.error.message);
    } catch {
      setFailure("The operation failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const removeAccount = useCallback(() => {
    const confirmed = window.confirm(
      "Remove this account? This deletes its local browser profile and cached Telegram session.",
    );
    if (confirmed) {
      void run(() => window.api.removeAccount({ deleteProfile: true }));
    }
  }, [run]);

  const errorMessage = failure ?? view.error?.message;
  const hasAccount = view.id !== null;

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Phase 2 · Browser Manager</p>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">
          Local Windows connector. Unofficial and not affiliated with Telegram.
        </p>
      </header>

      <section className="card" aria-labelledby="status-heading">
        <h2 id="status-heading">{hasAccount ? view.label : "No account connected"}</h2>

        <dl>
          <div>
            <dt>Connector</dt>
            <dd>{info ? "Ready" : "Starting…"}</dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>{STATUS_LABELS[view.status]}</dd>
          </div>
          <div>
            <dt>Browser</dt>
            <dd>{browserOpen(view) ? "Open" : "Closed"}</dd>
          </div>
          <div>
            <dt>Login</dt>
            <dd>{view.loginState ? LOGIN_LABELS[view.loginState] : "Not checked"}</dd>
          </div>
          {view.lastConnectedAt ? (
            <div>
              <dt>Last connected</dt>
              <dd>{new Date(view.lastConnectedAt).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>

        {errorMessage ? (
          <p className="error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {view.status === "waiting_for_login" || view.status === "authenticating" ? (
          <p className="hint">
            Scan the QR code in the Telegram window. If Telegram asks for a code or two-step
            password, enter it there. The connector never sees or stores it.
          </p>
        ) : null}

        <div className="actions">
          {!hasAccount ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => window.api.startAccount())}
            >
              Add Account
            </button>
          ) : null}

          {hasAccount && ["disconnected", "error"].includes(view.status) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => window.api.startAccount())}
            >
              {view.status === "error" ? "Reconnect" : "Connect"}
            </button>
          ) : null}

          {hasAccount && browserOpen(view) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => window.api.openTelegram())}
            >
              Open Telegram
            </button>
          ) : null}

          {hasAccount && (view.status === "connected" || browserOpen(view)) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => window.api.stopAccount())}
            >
              Disconnect
            </button>
          ) : null}

          {hasAccount ? (
            <button type="button" className="danger" disabled={busy} onClick={removeAccount}>
              Remove Account
            </button>
          ) : null}
        </div>
      </section>

      <footer>
        {info ? `${info.appName} ${info.appVersion} · ${info.platform}` : null}
        <br />
        Multi-account, Telegram tools, and MCP are not part of this phase.
      </footer>
    </main>
  );
}
