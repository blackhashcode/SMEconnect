import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load mock-api/.env if present (KEY=value lines). Real environment variables win.
const envFile = path.join(serverRoot, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
  }
}

function int(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: int(process.env.PORT, 4000),
  isProduction: process.env.NODE_ENV === "production",
  /** SQLite file. Created and seeded automatically on first start. */
  dbPath: path.resolve(serverRoot, process.env.DB_PATH ?? "data/smeconnect.db"),
  sessionCookie: "sme_session",
  sessionTtlMs: int(process.env.SESSION_TTL_DAYS, 7) * 24 * 60 * 60 * 1000,
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 10),
  /** Password given to every seeded demo account. Override with SEED_PASSWORD. */
  seedPassword: process.env.SEED_PASSWORD ?? "Demo@12345",
};
