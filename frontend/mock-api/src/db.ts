import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { config } from "./config.ts";

/**
 * SQLite via sql.js (WebAssembly, no native build step). The database lives in
 * memory and is written to `config.dbPath` shortly after every change, using a
 * write-then-rename so a crash never leaves a half-written file.
 */

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id               TEXT PRIMARY KEY,
    email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash    TEXT NOT NULL,
    name             TEXT NOT NULL,
    role             TEXT NOT NULL CHECK (role IN ('business', 'investor', 'admin')),
    phone            TEXT,
    headline         TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    avatar           TEXT NOT NULL,
    cover            TEXT NOT NULL,
    about            TEXT NOT NULL DEFAULT '',
    verified         INTEGER NOT NULL DEFAULT 0,
    connections      INTEGER NOT NULL DEFAULT 0,
    rating           REAL NOT NULL DEFAULT 0,
    joined           TEXT NOT NULL,
    completed_loans  INTEGER,
    offers_made      INTEGER,
    committed        INTEGER,
    followers        INTEGER,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id               TEXT PRIMARY KEY,
    owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    tagline          TEXT NOT NULL DEFAULT '',
    location         TEXT NOT NULL DEFAULT '',
    founded          TEXT NOT NULL DEFAULT '',
    team_size        TEXT NOT NULL DEFAULT '',
    monthly_revenue  INTEGER NOT NULL DEFAULT 0,
    image            TEXT NOT NULL,
    gallery          TEXT NOT NULL DEFAULT '[]',
    description      TEXT NOT NULL DEFAULT '',
    verified         INTEGER NOT NULL DEFAULT 0,
    specialties      TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS businesses_owner ON businesses(owner_id);

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS loan_requests (
    id                   TEXT PRIMARY KEY,
    business_id          TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    amount               INTEGER NOT NULL CHECK (amount > 0),
    purpose              TEXT NOT NULL,
    tenure_months        INTEGER NOT NULL,
    rate                 REAL NOT NULL,
    status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'offers_received', 'agreed', 'closed')),
    description          TEXT NOT NULL DEFAULT '',
    repayment_frequency  TEXT NOT NULL DEFAULT 'Monthly',
    image                TEXT NOT NULL DEFAULT '',
    highlights           TEXT NOT NULL DEFAULT '[]',
    progress             INTEGER NOT NULL DEFAULT 0,
    connections_count    INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS loan_requests_business ON loan_requests(business_id);

  CREATE TABLE IF NOT EXISTS loan_offers (
    id               TEXT PRIMARY KEY,
    request_id       TEXT NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
    investor_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount           INTEGER NOT NULL CHECK (amount > 0),
    rate             REAL NOT NULL,
    tenure_months    INTEGER NOT NULL,
    frequency        TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'negotiating', 'accepted', 'declined', 'withdrawn')),
    note             TEXT NOT NULL DEFAULT '',
    counter_amount   INTEGER,
    counter_rate     REAL,
    counter_tenure   INTEGER,
    counter_note     TEXT,
    last_action_by   TEXT NOT NULL DEFAULT 'investor' CHECK (last_action_by IN ('investor', 'owner')),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS loan_offers_request ON loan_offers(request_id);
  CREATE INDEX IF NOT EXISTS loan_offers_investor ON loan_offers(investor_id);

  CREATE TABLE IF NOT EXISTS threads (
    id               TEXT PRIMARY KEY,
    subject          TEXT NOT NULL,
    business_id      TEXT REFERENCES businesses(id) ON DELETE SET NULL,
    loan_request_id  TEXT REFERENCES loan_requests(id) ON DELETE SET NULL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS thread_participants (
    thread_id     TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at  TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
    PRIMARY KEY (thread_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS thread_participants_user ON thread_participants(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'offer', 'system')),
    offer_id    TEXT REFERENCES loan_offers(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id, created_at);
`;

let db: Database | null = null;
let saveTimer: NodeJS.Timeout | null = null;

export async function openDatabase() {
  const SQL = await initSqlJs();
  const exists = fs.existsSync(config.dbPath);
  db = exists ? new SQL.Database(fs.readFileSync(config.dbPath)) : new SQL.Database();
  db.exec(SCHEMA);
  return { isNew: !exists };
}

function handle() {
  if (!db) throw new Error("Database not opened. Call openDatabase() first.");
  return db;
}

type Params = Record<string, SqlValue> | SqlValue[];

/** All rows as plain objects. */
export function all<T>(sql: string, params: Params = []): T[] {
  const stmt = handle().prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** First row, or undefined. */
export function get<T>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

/** Run a write statement and schedule a save to disk. */
export function run(sql: string, params: Params = []) {
  handle().run(sql, params);
  scheduleSave();
}

/** Run several writes atomically. */
export function transaction(work: () => void) {
  const database = handle();
  database.exec("BEGIN");
  try {
    work();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 150);
}

export function saveNow() {
  if (!db) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const tmp = `${config.dbPath}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, config.dbPath);
}
