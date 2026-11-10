import type { LoginState } from "../../shared/account";

export type { LoginState };

export type LoginDetection = {
  readonly state: LoginState;
  readonly evidence: readonly string[];
};

export type PageProbe = {
  url(): string;
  isVisible(selector: string): Promise<boolean>;
  count(selector: string): Promise<number>;
};
