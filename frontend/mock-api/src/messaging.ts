import { get, run } from "./db.ts";
import { newId, nowIso, toMessageView, type MessageRow } from "./views.ts";

/** The existing one-to-one conversation between two members, or a new one. `created` says which. */
export function ensureThread(
  userA: string,
  userB: string,
  context: { subject: string; businessId?: string | null; loanRequestId?: string | null },
) {
  const existing = get<{ id: string }>(
    `SELECT a.thread_id AS id FROM thread_participants a
     JOIN thread_participants b ON b.thread_id = a.thread_id AND b.user_id = ?
     WHERE a.user_id = ?
       AND (SELECT COUNT(*) FROM thread_participants c WHERE c.thread_id = a.thread_id) = 2
     LIMIT 1`,
    [userB, userA],
  );
  if (existing) {
    // Attach loan context to an older general conversation once it becomes relevant.
    if (context.loanRequestId) {
      run("UPDATE threads SET loan_request_id = COALESCE(loan_request_id, ?), business_id = COALESCE(business_id, ?) WHERE id = ?", [
        context.loanRequestId,
        context.businessId ?? null,
        existing.id,
      ]);
    }
    return { id: existing.id, created: false };
  }

  const id = newId("th");
  const now = nowIso();
  run("INSERT INTO threads (id, subject, business_id, loan_request_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    context.subject,
    context.businessId ?? null,
    context.loanRequestId ?? null,
    now,
    now,
  ]);
  run("INSERT INTO thread_participants (thread_id, user_id, last_read_at) VALUES (?, ?, ?)", [id, userA, now]);
  run("INSERT INTO thread_participants (thread_id, user_id) VALUES (?, ?)", [id, userB]);
  return { id, created: true };
}

export function postMessage(threadId: string, senderId: string, text: string, kind: MessageRow["kind"] = "text", offerId: string | null = null) {
  const row: MessageRow = { id: newId("msg"), thread_id: threadId, sender_id: senderId, text, kind, offer_id: offerId, created_at: nowIso() };
  run("INSERT INTO messages (id, thread_id, sender_id, text, kind, offer_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    row.id,
    row.thread_id,
    row.sender_id,
    row.text,
    row.kind,
    row.offer_id,
    row.created_at,
  ]);
  run("UPDATE threads SET updated_at = ? WHERE id = ?", [row.created_at, threadId]);
  // Sending a message means you've seen the conversation up to now.
  run("UPDATE thread_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?", [row.created_at, threadId, senderId]);
  return toMessageView(row);
}
