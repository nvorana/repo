import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Loads KEY=value pairs from the repo-root .env into process.env (existing
// env vars win). Import this before anything that reads configuration.
const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env");

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    const value = m[2].replace(/^(["'])(.*)\1$/, "$2");
    process.env[m[1]] ??= value;
  }
}
