export type LoginState = "LOGIN_REQUIRED" | "AUTHENTICATING" | "CONNECTED" | "UNKNOWN";

export type LoginDetection = {
  readonly state: LoginState;
  readonly evidence: readonly string[];
};

export type PageProbe = {
  url(): string;
  isVisible(selector: string): Promise<boolean>;
  count(selector: string): Promise<number>;
};
