import crypto from "node:crypto";
import type { AgreementView, LoanOfferView, LoanRequest, LoanRequestView, MessageView, ThreadView } from "../../src/data/types.ts";
import { all, get } from "./db.ts";
import { toBusiness, toPerson, type BusinessRow, type UserRow } from "./models.ts";

/** Short prefixed id, e.g. "lr-9f3a1c2b". */
export const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
export const nowIso = () => new Date().toISOString();

// ---------- Row types ----------

export type LoanRow = {
  id: string;
  business_id: string;
  title: string;
  amount: number;
  purpose: string;
  tenure_months: number;
  rate: number;
  status: LoanRequest["status"];
  description: string;
  repayment_frequency: string;
  image: string;
  highlights: string;
  progress: number;
  connections_count: number;
  created_at: string;
};

export type OfferRow = {
  id: string;
  request_id: string;
  investor_id: string;
  amount: number;
  rate: number;
  tenure_months: number;
  frequency: string;
  status: LoanOfferView["status"];
  note: string;
  counter_amount: number | null;
  counter_rate: number | null;
  counter_tenure: number | null;
  counter_note: string | null;
  last_action_by: "investor" | "owner";
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string;
  kind: MessageView["kind"];
  offer_id: string | null;
  created_at: string;
};

// ---------- Loans ----------

function parseList(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Offers that still count toward a request (not withdrawn). */
const liveOfferCount = (requestId: string) =>
  get<{ n: number }>("SELECT COUNT(*) AS n FROM loan_offers WHERE request_id = ? AND status != 'withdrawn'", [requestId])?.n ?? 0;

export function toLoanView(row: LoanRow): LoanRequestView | null {
  const business = get<BusinessRow>("SELECT * FROM businesses WHERE id = ?", [row.business_id]);
  const owner = business ? get<UserRow>("SELECT * FROM users WHERE id = ?", [business.owner_id]) : undefined;
  if (!business || !owner) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    title: row.title,
    amount: row.amount,
    purpose: row.purpose,
    tenureMonths: row.tenure_months,
    rate: row.rate,
    status: row.status,
    createdAt: row.created_at,
    offersCount: liveOfferCount(row.id),
    connectionsCount: row.connections_count,
    progress: row.progress,
    description: row.description,
    repaymentFrequency: row.repayment_frequency,
    image: row.image,
    highlights: parseList(row.highlights),
    business: toBusiness(business),
    owner: toPerson(owner),
  };
}

export function loanViews(rows: LoanRow[]) {
  return rows.map(toLoanView).filter((view): view is LoanRequestView => view !== null);
}

export const findLoan = (id: string) => get<LoanRow>("SELECT * FROM loan_requests WHERE id = ?", [id]);

/** The user id that owns the business behind a loan request. */
export const loanOwnerId = (loan: LoanRow) =>
  get<{ owner_id: string }>("SELECT owner_id FROM businesses WHERE id = ?", [loan.business_id])?.owner_id;

// ---------- Offers ----------

export function toOfferView(row: OfferRow): LoanOfferView | null {
  const investor = get<UserRow>("SELECT * FROM users WHERE id = ?", [row.investor_id]);
  const loan = findLoan(row.request_id);
  const business = loan ? get<BusinessRow>("SELECT * FROM businesses WHERE id = ?", [loan.business_id]) : undefined;
  if (!investor || !loan || !business) return null;
  return {
    id: row.id,
    requestId: row.request_id,
    investorId: row.investor_id,
    amount: row.amount,
    rate: row.rate,
    tenureMonths: row.tenure_months,
    frequency: row.frequency,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    counter:
      row.counter_amount !== null && row.counter_rate !== null && row.counter_tenure !== null
        ? { amount: row.counter_amount, rate: row.counter_rate, tenureMonths: row.counter_tenure, note: row.counter_note ?? "" }
        : undefined,
    lastActionBy: row.last_action_by,
    investor: toPerson(investor),
    request: {
      id: loan.id,
      title: loan.title,
      amount: loan.amount,
      status: loan.status,
      business: { id: business.id, name: business.name, category: business.category, ownerId: business.owner_id },
    },
  };
}

export function offerViews(rows: OfferRow[]) {
  return rows.map(toOfferView).filter((view): view is LoanOfferView => view !== null);
}

export const findOffer = (id: string) => get<OfferRow>("SELECT * FROM loan_offers WHERE id = ?", [id]);

/** The offer an agreement is based on: an accepted one, else the one under negotiation. */
export function agreementFor(loan: LoanRow): AgreementView | null {
  const row =
    get<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND status = 'accepted' ORDER BY updated_at DESC LIMIT 1", [loan.id]) ??
    get<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND status = 'negotiating' ORDER BY updated_at DESC LIMIT 1", [loan.id]);
  const loanView = toLoanView(loan);
  const offer = row ? toOfferView(row) : null;
  if (!row || !loanView || !offer) return null;
  return { status: row.status === "accepted" ? "agreed" : "draft", loan: loanView, offer };
}

// ---------- Messages ----------

export function toMessageView(row: MessageRow): MessageView {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    text: row.text,
    kind: row.kind,
    offerId: row.offer_id,
    createdAt: row.created_at,
  };
}

export const isParticipant = (threadId: string, userId: string) =>
  Boolean(get("SELECT 1 FROM thread_participants WHERE thread_id = ? AND user_id = ?", [threadId, userId]));

/** One conversation as the given member sees it. */
export function toThreadView(threadId: string, viewerId: string): ThreadView | null {
  const thread = get<{ id: string; subject: string; loan_request_id: string | null; updated_at: string }>(
    "SELECT id, subject, loan_request_id, updated_at FROM threads WHERE id = ?",
    [threadId],
  );
  const me = get<{ last_read_at: string }>("SELECT last_read_at FROM thread_participants WHERE thread_id = ? AND user_id = ?", [threadId, viewerId]);
  const otherRow = get<UserRow>(
    `SELECT u.* FROM thread_participants p JOIN users u ON u.id = p.user_id
     WHERE p.thread_id = ? AND p.user_id != ? LIMIT 1`,
    [threadId, viewerId],
  );
  if (!thread || !me || !otherRow) return null;

  const last = get<MessageRow>("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1", [threadId]);
  const unread =
    get<{ n: number }>("SELECT COUNT(*) AS n FROM messages WHERE thread_id = ? AND sender_id != ? AND created_at > ?", [threadId, viewerId, me.last_read_at])?.n ?? 0;
  const business = get<{ id: string; name: string }>("SELECT id, name FROM businesses WHERE owner_id = ? LIMIT 1", [otherRow.id]);

  return {
    id: thread.id,
    subject: thread.subject,
    other: toPerson(otherRow),
    business: business ?? null,
    loanRequestId: thread.loan_request_id,
    lastMessage: last?.text ?? "",
    lastMessageAt: last?.created_at ?? thread.updated_at,
    unread,
  };
}

export function threadsFor(userId: string) {
  const ids = all<{ id: string }>(
    `SELECT t.id FROM threads t JOIN thread_participants p ON p.thread_id = t.id
     WHERE p.user_id = ? ORDER BY t.updated_at DESC`,
    [userId],
  );
  return ids.map(({ id }) => toThreadView(id, userId)).filter((view): view is ThreadView => view !== null);
}
