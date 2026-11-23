import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { config } from "./config.ts";

/**
 * Local SQLite stand-in via sql.js (WebAssembly, zero native build step).
 * Writes atomically via write-then-rename. Production deployments use
 * PostgreSQL + Prisma in `backend/`.
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

  CREATE TABLE IF NOT EXISTS repayments (
    id              TEXT PRIMARY KEY,
    loan_request_id TEXT NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
    installment_no  INTEGER NOT NULL,
    due_date        TEXT NOT NULL,
    amount_bdt      INTEGER NOT NULL CHECK (amount_bdt > 0),
    status          TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'MARKED_PAID', 'CONFIRMED', 'OVERDUE')),
    marked_paid_at  TEXT,
    confirmed_at    TEXT,
    note            TEXT,
    UNIQUE (loan_request_id, installment_no)
  );
  CREATE INDEX IF NOT EXISTS repayments_loan ON repayments(loan_request_id, installment_no);

  CREATE TABLE IF NOT EXISTS connections (
    id            TEXT PRIMARY KEY,
    requester_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    created_at    TEXT NOT NULL,
    UNIQUE (requester_id, addressee_id)
  );
  CREATE INDEX IF NOT EXISTS connections_requester ON connections(requester_id);
  CREATE INDEX IF NOT EXISTS connections_addressee ON connections(addressee_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('offer', 'connection', 'message', 'system')),
    person_id    TEXT,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    action_label TEXT,
    href         TEXT,
    read_at      TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at);

  CREATE TABLE IF NOT EXISTS verifications (
    id            TEXT PRIMARY KEY,
    person_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('Business', 'Investor')),
    nid           TEXT NOT NULL,
    trade_license TEXT NOT NULL DEFAULT 'N/A',
    documents     TEXT NOT NULL DEFAULT '[]',
    risk          TEXT NOT NULL DEFAULT 'low' CHECK (risk IN ('low', 'medium', 'high')),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    review_note   TEXT,
    reviewed_by   TEXT,
    submitted_at  TEXT NOT NULL,
    reviewed_at   TEXT
  );
  CREATE INDEX IF NOT EXISTS verifications_status ON verifications(status, submitted_at);

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

  CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    actor_id    TEXT,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    metadata    TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_logs_entity ON audit_logs(entity_type, entity_id);
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

export function get<T>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: Params = []) {
  handle().run(sql, params);
  scheduleSave();
}

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

export function recordAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  run(
    "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      `aud-${crypto.randomUUID().slice(0, 12)}`,
      actorId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString(),
    ],
  );
}

export function pushNotification(input: {
  userId: string;
  kind: "offer" | "connection" | "message" | "system";
  personId?: string;
  title: string;
  body: string;
  actionLabel?: string;
  href?: string;
}) {
  run(
    `INSERT INTO notifications (id, user_id, kind, person_id, title, body, action_label, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `ntf-${crypto.randomUUID().slice(0, 12)}`,
      input.userId,
      input.kind,
      input.personId ?? null,
      input.title,
      input.body,
      input.actionLabel ?? null,
      input.href ?? null,
      new Date().toISOString(),
    ],
  );
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveNow();
  }, 100);
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
