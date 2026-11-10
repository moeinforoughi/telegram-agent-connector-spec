import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountStatus, AccountView } from "../../shared/account";
import { APP_NAME } from "../../shared/constants";
import type { IpcResult } from "../../shared/ipc";
import {
  DEFAULT_PROXY_FORM,
  PROXY_PROTOCOLS,
  type ProxyProtocol,
  type ProxySettingsView,
  type ProxyTestResult,
  type SaveProxySettingsRequest,
} from "../../shared/proxy";
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

const PROTOCOL_LABELS: Record<ProxyProtocol, string> = {
  socks5: "SOCKS5",
  http: "HTTP",
};

type ProxyForm = {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  hasPassword: boolean;
  secureStorageAvailable: boolean;
};

const EMPTY_PROXY_FORM: ProxyForm = {
  enabled: DEFAULT_PROXY_FORM.enabled,
  protocol: DEFAULT_PROXY_FORM.protocol,
  host: DEFAULT_PROXY_FORM.host,
  port: String(DEFAULT_PROXY_FORM.port),
  username: DEFAULT_PROXY_FORM.username,
  password: "",
  hasPassword: false,
  secureStorageAvailable: true,
};

function formFromView(view: ProxySettingsView): ProxyForm {
  return {
    enabled: view.enabled,
    protocol: view.protocol,
    host: view.host,
    port: String(view.port),
    username: view.username,
    password: "",
    hasPassword: view.hasPassword,
    secureStorageAvailable: view.secureStorageAvailable,
  };
}

function browserOpen(view: AccountView): boolean {
  return ["initializing", "waiting_for_login", "authenticating", "connected"].includes(view.status);
}

function describeProxyTest(result: ProxyTestResult): string {
  switch (result.status) {
    case "success":
      return result.latencyMs === undefined
        ? "Proxy connection succeeded."
        : `Proxy connection succeeded (${result.latencyMs} ms).`;
    case "connection_refused":
      return "The proxy refused the connection. Check the host and port.";
    case "timeout":
      return "The proxy connection timed out.";
    case "auth_failed":
      return "Proxy authentication failed. Check the username and password.";
    case "invalid_config":
      return `Invalid proxy configuration: ${result.message}`;
    default:
      return "The proxy is unavailable.";
  }
}

function buildProxyRequest(form: ProxyForm): SaveProxySettingsRequest | null {
  const port = Number(form.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    enabled: form.enabled,
    protocol: form.protocol,
    host: form.host,
    port,
    username: form.username,
    ...(form.password ? { password: form.password } : {}),
  };
}

export function App() {
  const [view, setView] = useState<AccountView>(EMPTY_VIEW);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proxy, setProxy] = useState<ProxyForm>(EMPTY_PROXY_FORM);
  const [proxyBusy, setProxyBusy] = useState<"save" | "test" | null>(null);
  const [proxyMessage, setProxyMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );
  const proxyTouched = useRef(false);

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
    window.api.getProxySettings().then((result) => {
      if (!active) return;
      // Do not overwrite edits the user made before the initial load resolved.
      if (result.ok && !proxyTouched.current) setProxy(formFromView(result.data));
      if (!result.ok) setProxyMessage({ kind: "error", text: result.error.message });
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

  const updateProxy = useCallback((patch: Partial<ProxyForm>) => {
    proxyTouched.current = true;
    setProxy((current) => ({ ...current, ...patch }));
  }, []);

  const persistProxy = useCallback(
    async (form: ProxyForm, successMessage: string): Promise<boolean> => {
      const request = buildProxyRequest(form);
      if (!request) {
        setProxyMessage({ kind: "error", text: "Port must be an integer between 1 and 65535." });
        return false;
      }
      setProxyBusy("save");
      setProxyMessage(null);
      try {
        const result = await window.api.saveProxySettings(request);
        if (result.ok) {
          setProxy(formFromView(result.data));
          setProxyMessage({ kind: "ok", text: successMessage });
          return true;
        }
        setProxyMessage({ kind: "error", text: result.error.message });
        return false;
      } catch {
        setProxyMessage({ kind: "error", text: "Could not save proxy settings." });
        return false;
      } finally {
        setProxyBusy(null);
      }
    },
    [],
  );

  const saveProxy = useCallback(async () => {
    await persistProxy(proxy, "Proxy settings saved.");
  }, [persistProxy, proxy]);

  const toggleProxy = useCallback(
    (enabled: boolean) => {
      const next = { ...proxy, enabled };
      proxyTouched.current = true;
      setProxy(next);
      // Persist immediately: the enabled flag must never stay only in the form.
      void persistProxy(next, "Proxy settings saved.");
    },
    [persistProxy, proxy],
  );

  const testProxy = useCallback(async () => {
    const request = buildProxyRequest(proxy);
    if (!request) {
      setProxyMessage({ kind: "error", text: "Port must be an integer between 1 and 65535." });
      return;
    }
    setProxyBusy("test");
    setProxyMessage(null);
    try {
      const result = await window.api.testProxy({
        protocol: request.protocol,
        host: request.host,
        port: request.port,
        username: request.username,
        ...(request.password ? { password: request.password } : {}),
      });
      if (result.ok) {
        setProxyMessage({
          kind: result.data.status === "success" ? "ok" : "error",
          text: describeProxyTest(result.data),
        });
      } else {
        setProxyMessage({ kind: "error", text: result.error.message });
      }
    } catch {
      setProxyMessage({ kind: "error", text: "Proxy test failed." });
    } finally {
      setProxyBusy(null);
    }
  }, [proxy]);

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

      <section className="card" aria-labelledby="proxy-heading">
        <h2 id="proxy-heading">Network / Proxy</h2>
        <p className="hint">
          The connector uses only this proxy. There is no automatic fallback: if the proxy is down,
          Telegram will not load and the settings stay selected.
        </p>

        <div className="proxy-form">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={proxy.enabled}
              disabled={proxyBusy !== null}
              onChange={(event) => toggleProxy(event.target.checked)}
            />
            Enable proxy
          </label>

          <label>
            Protocol
            <select
              value={proxy.protocol}
              disabled={proxyBusy !== null}
              onChange={(event) => updateProxy({ protocol: event.target.value as ProxyProtocol })}
            >
              {PROXY_PROTOCOLS.map((protocol) => (
                <option key={protocol} value={protocol}>
                  {PROTOCOL_LABELS[protocol]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Host / IP
            <input
              type="text"
              value={proxy.host}
              disabled={proxyBusy !== null}
              spellCheck={false}
              onChange={(event) => updateProxy({ host: event.target.value })}
            />
          </label>

          <label>
            Port
            <input
              type="number"
              min={1}
              max={65535}
              value={proxy.port}
              disabled={proxyBusy !== null}
              onChange={(event) => updateProxy({ port: event.target.value })}
            />
          </label>

          <label>
            Username (optional)
            <input
              type="text"
              value={proxy.username}
              disabled={proxyBusy !== null}
              autoComplete="off"
              onChange={(event) => updateProxy({ username: event.target.value })}
            />
          </label>

          <label>
            Password (optional)
            <input
              type="password"
              value={proxy.password}
              disabled={proxyBusy !== null}
              autoComplete="off"
              placeholder={proxy.hasPassword ? "Saved — leave blank to keep" : "Not set"}
              onChange={(event) => updateProxy({ password: event.target.value })}
            />
          </label>
        </div>

        {!proxy.secureStorageAvailable ? (
          <p className="error" role="alert">
            OS secure storage is unavailable. Proxy credentials will not be saved.
          </p>
        ) : null}

        <div className="actions">
          <button type="button" disabled={proxyBusy !== null} onClick={() => void testProxy()}>
            {proxyBusy === "test" ? "Testing…" : "Test Proxy"}
          </button>
          <button type="button" disabled={proxyBusy !== null} onClick={() => void saveProxy()}>
            {proxyBusy === "save" ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {proxyMessage ? (
          <p className={proxyMessage.kind === "ok" ? "hint" : "error"} role="status">
            {proxyMessage.text}
          </p>
        ) : null}
      </section>

      <footer>
        {info ? `${info.appName} ${info.appVersion} · ${info.platform}` : null}
        <br />
        Multi-account, Telegram tools, and MCP are not part of this phase.
      </footer>
    </main>
  );
}
