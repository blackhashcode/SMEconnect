import crypto from "node:crypto";
import type {
  AgreementView,
  LoanOfferView,
  LoanRequest,
  LoanRequestView,
  MessageView,
  RepaymentItem,
  ThreadView,
} from "../../src/data/types.ts";
import { all, get } from "./db.ts";
import { batchInvestorStats, toBusiness, toPerson, type BusinessRow, type UserRow } from "./models.ts";

/** Collision-resistant prefixed id using randomUUID. */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
export const nowIso = () => new Date().toISOString();

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

export type RepaymentRow = {
  id: string;
  loan_request_id: string;
  installment_no: number;
  due_date: string;
  amount_bdt: number;
  status: RepaymentItem["status"];
  marked_paid_at: string | null;
  confirmed_at: string | null;
  note: string | null;
};

function parseList(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function inClause(ids: string[]) {
  return ids.map(() => "?").join(", ");
}

// ---------- Loans (Batched — zero N+1) ----------

export function loanViews(rows: LoanRow[]): LoanRequestView[] {
  if (rows.length === 0) return [];
  const businessIds = [...new Set(rows.map((r) => r.business_id))];
  const loanIds = rows.map((r) => r.id);

  const businesses = all<BusinessRow>(`SELECT * FROM businesses WHERE id IN (${inClause(businessIds)})`, businessIds);
  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  const ownerIds = [...new Set(businesses.map((b) => b.owner_id))];
  const owners = ownerIds.length ? all<UserRow>(`SELECT * FROM users WHERE id IN (${inClause(ownerIds)})`, ownerIds) : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  const counts = all<{ request_id: string; n: number }>(
    `SELECT request_id, COUNT(*) AS n FROM loan_offers WHERE request_id IN (${inClause(loanIds)}) AND status != 'withdrawn' GROUP BY request_id`,
    loanIds,
  );
  const countMap = new Map(counts.map((c) => [c.request_id, c.n]));

  const results: LoanRequestView[] = [];
  for (const row of rows) {
    const business = businessMap.get(row.business_id);
    const owner = business ? ownerMap.get(business.owner_id) : undefined;
    if (!business || !owner) continue;
    results.push({
      id: row.id,
      businessId: row.business_id,
      title: row.title,
      amount: row.amount,
      purpose: row.purpose,
      tenureMonths: row.tenure_months,
      rate: row.rate,
      status: row.status,
      createdAt: row.created_at,
      offersCount: countMap.get(row.id) ?? 0,
      connectionsCount: row.connections_count,
      progress: row.progress,
      description: row.description,
      repaymentFrequency: row.repayment_frequency,
      image: row.image,
      highlights: parseList(row.highlights),
      business: toBusiness(business),
      owner: toPerson(owner),
    });
  }
  return results;
}

export function toLoanView(row: LoanRow): LoanRequestView | null {
  return loanViews([row])[0] ?? null;
}

export const findLoan = (id: string) => get<LoanRow>("SELECT * FROM loan_requests WHERE id = ?", [id]);

export const loanOwnerId = (loan: LoanRow) =>
  get<{ owner_id: string }>("SELECT owner_id FROM businesses WHERE id = ?", [loan.business_id])?.owner_id;

// ---------- Offers (Batched — zero N+1) ----------

export function offerViews(rows: OfferRow[]): LoanOfferView[] {
  if (rows.length === 0) return [];
  const investorIds = [...new Set(rows.map((r) => r.investor_id))];
  const requestIds = [...new Set(rows.map((r) => r.request_id))];

  const investors = all<UserRow>(`SELECT * FROM users WHERE id IN (${inClause(investorIds)})`, investorIds);
  const investorMap = new Map(investors.map((i) => [i.id, i]));
  const stats = batchInvestorStats(investorIds);

  const loans = all<LoanRow>(`SELECT * FROM loan_requests WHERE id IN (${inClause(requestIds)})`, requestIds);
  const loanMap = new Map(loans.map((l) => [l.id, l]));

  const businessIds = [...new Set(loans.map((l) => l.business_id))];
  const businesses = businessIds.length ? all<BusinessRow>(`SELECT * FROM businesses WHERE id IN (${inClause(businessIds)})`, businessIds) : [];
  const businessMap = new Map(businesses.map((b) => [b.id, b]));

  const results: LoanOfferView[] = [];
  for (const row of rows) {
    const investor = investorMap.get(row.investor_id);
    const loan = loanMap.get(row.request_id);
    const business = loan ? businessMap.get(loan.business_id) : undefined;
    if (!investor || !loan || !business) continue;
    results.push({
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
      investor: toPerson(investor, stats),
      request: {
        id: loan.id,
        title: loan.title,
        amount: loan.amount,
        status: loan.status,
        business: { id: business.id, name: business.name, category: business.category, ownerId: business.owner_id },
      },
    });
  }
  return results;
}

export function toOfferView(row: OfferRow): LoanOfferView | null {
  return offerViews([row])[0] ?? null;
}

export const findOffer = (id: string) => get<OfferRow>("SELECT * FROM loan_offers WHERE id = ?", [id]);

export function repaymentsForLoan(loanRequestId: string): RepaymentItem[] {
  const rows = all<RepaymentRow>(
    "SELECT * FROM repayments WHERE loan_request_id = ? ORDER BY installment_no ASC",
    [loanRequestId],
  );
  return rows.map((r) => ({
    id: r.id,
    loanRequestId: r.loan_request_id,
    installmentNo: r.installment_no,
    dueDate: r.due_date,
    amountBdt: r.amount_bdt,
    status: r.status,
    markedPaidAt: r.marked_paid_at,
    confirmedAt: r.confirmed_at,
    note: r.note,
  }));
}

export function agreementFor(loan: LoanRow): AgreementView | null {
  const row =
    get<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND status = 'accepted' ORDER BY updated_at DESC LIMIT 1", [loan.id]) ??
    get<OfferRow>("SELECT * FROM loan_offers WHERE request_id = ? AND status = 'negotiating' ORDER BY updated_at DESC LIMIT 1", [loan.id]);
  const loanView = toLoanView(loan);
  const offer = row ? toOfferView(row) : null;
  if (!row || !loanView || !offer) return null;
  const repayments = repaymentsForLoan(loan.id);
  return { status: row.status === "accepted" ? "agreed" : "draft", loan: loanView, offer, repayments };
}

// ---------- Messages (Batched — zero N+1) ----------

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

export function threadsFor(userId: string): ThreadView[] {
  const threadRows = all<{ id: string; subject: string; loan_request_id: string | null; updated_at: string; last_read_at: string }>(
    `SELECT t.id, t.subject, t.loan_request_id, t.updated_at, p.last_read_at
     FROM threads t JOIN thread_participants p ON p.thread_id = t.id
     WHERE p.user_id = ? ORDER BY t.updated_at DESC`,
    [userId],
  );
  if (threadRows.length === 0) return [];

  const threadIds = threadRows.map((t) => t.id);
  const ph = inClause(threadIds);

  const otherRows = all<UserRow & { thread_id: string }>(
    `SELECT u.*, p.thread_id FROM thread_participants p JOIN users u ON u.id = p.user_id
     WHERE p.thread_id IN (${ph}) AND p.user_id != ?`,
    [...threadIds, userId],
  );
  const otherMap = new Map(otherRows.map((r) => [r.thread_id, r]));
  const investorStats = batchInvestorStats(otherRows.filter((r) => r.role === "investor").map((r) => r.id));

  const otherUserIds = [...new Set(otherRows.map((r) => r.id))];
  const bizRows = otherUserIds.length
    ? all<{ id: string; owner_id: string; name: string }>(
        `SELECT id, owner_id, name FROM businesses WHERE owner_id IN (${inClause(otherUserIds)})`,
        otherUserIds,
      )
    : [];
  const bizMap = new Map(bizRows.map((b) => [b.owner_id, { id: b.id, name: b.name }]));

  const lastMsgs = all<MessageRow>(
    `SELECT m.* FROM messages m
     INNER JOIN (SELECT thread_id, MAX(created_at) AS max_at FROM messages WHERE thread_id IN (${ph}) GROUP BY thread_id) latest
       ON latest.thread_id = m.thread_id AND latest.max_at = m.created_at`,
    threadIds,
  );
  const lastMsgMap = new Map(lastMsgs.map((m) => [m.thread_id, m]));

  const unreadRows = all<{ thread_id: string; n: number }>(
    `SELECT m.thread_id, COUNT(*) AS n
     FROM messages m
     JOIN thread_participants p ON p.thread_id = m.thread_id AND p.user_id = ?
     WHERE m.thread_id IN (${ph}) AND m.sender_id != ? AND m.created_at > p.last_read_at
     GROUP BY m.thread_id`,
    [userId, ...threadIds, userId],
  );
  const unreadMap = new Map(unreadRows.map((u) => [u.thread_id, u.n]));

  const results: ThreadView[] = [];
  for (const t of threadRows) {
    const other = otherMap.get(t.id);
    if (!other) continue;
    const last = lastMsgMap.get(t.id);
    results.push({
      id: t.id,
      subject: t.subject,
      other: toPerson(other, investorStats),
      business: bizMap.get(other.id) ?? null,
      loanRequestId: t.loan_request_id,
      lastMessage: last?.text ?? "",
      lastMessageAt: last?.created_at ?? t.updated_at,
      unread: unreadMap.get(t.id) ?? 0,
    });
  }
  return results;
}

export function toThreadView(threadId: string, viewerId: string): ThreadView | null {
  return threadsFor(viewerId).find((t) => t.id === threadId) ?? null;
}
