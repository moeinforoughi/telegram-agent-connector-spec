import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type LogValue = string | number | boolean | null;
export type LogEvent = { event: string } & Record<string, LogValue>;

const logFile = path.join(config.logsDir, "spike-state.jsonl");

/** Structured spike log. Never pass page text, cookies, tokens or credentials. */
export function log(event: LogEvent): void {
  fs.mkdirSync(config.logsDir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  fs.appendFileSync(logFile, line + "\n", "utf8");
  process.stderr.write(line + "\n");
}
