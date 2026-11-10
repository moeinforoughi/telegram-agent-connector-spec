import fs from "node:fs";
import path from "node:path";

const logsDir = path.join(process.cwd(), "logs");
const secretPatterns = [
  /api_id/i,
  /api_hash/i,
  /bot_token/i,
  /auth_key/i,
  /authorization\s*:/i,
  /cookie\s*:/i,
  /password/i,
  /bearer\s+[a-z0-9._-]+/i,
  /\+98\d{9,}/,
];
const maxLineLength = 2_000;

if (!fs.existsSync(logsDir)) {
  console.log("No logs yet; nothing to scan.");
  process.exit(0);
}

const files = fs.readdirSync(logsDir).filter((name) => name.endsWith(".jsonl"));
const problems = [];

for (const file of files) {
  const lines = fs.readFileSync(path.join(logsDir, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.length === 0) return;
    if (line.length > maxLineLength) {
      problems.push(`${file}:${index + 1} line too long (${line.length})`);
    }
    try {
      JSON.parse(line);
    } catch {
      problems.push(`${file}:${index + 1} not valid JSON`);
    }
    for (const pattern of secretPatterns) {
      if (pattern.test(line)) {
        problems.push(`${file}:${index + 1} matches ${pattern}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error("Log check failed:\n" + problems.join("\n"));
  process.exit(1);
}

console.log(`Log check passed (${files.length} file(s)).`);
