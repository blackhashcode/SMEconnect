import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "../auth.ts";
import { all, get, pushNotification, run, transaction } from "../db.ts";
import { created, fail, ok } from "../http.ts";
import { ensureThread, postMessage } from "../messaging.ts";
import { cleanText } from "../text.ts";
import { isParticipant, nowIso, threadsFor, toMessageView, toThreadView, type MessageRow } from "../views.ts";

export const messagesRouter = Router();

const msgLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  key: (req) => `msg:${req.user?.id ?? "anon"}`,
});

messagesRouter.get("/threads", (req, res) => {
  const threads = threadsFor(req.user!.id);
  const unread = threads.reduce((sum, thread) => sum + thread.unread, 0);
  ok(res, { threads, unread }, { unread });
});

messagesRouter.get("/threads/unread-count", (req, res) => {
  const me = req.user!.id;
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages m JOIN thread_participants p ON p.thread_id = m.thread_id AND p.user_id = ?
     WHERE m.sender_id != ? AND m.created_at > p.last_read_at`,
    [me, me],
  );
  ok(res, { unread: row?.n ?? 0 });
});

const startSchema = z.object({
  participantId: z.string().min(1).max(80),
  subject: cleanText(0, 120).optional(),
  text: cleanText(0, 4000).optional(),
});

messagesRouter.post("/threads", msgLimiter, (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return void fail(res, 400, "VALIDATION_ERROR", "Choose who to message.");
  const me = req.user!;
  const { participantId, subject, text } = parsed.data;
  if (participantId === me.id) return void fail(res, 400, "VALIDATION_ERROR", "You can't message yourself.");

  const other = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE id = ? AND role != 'admin'", [participantId]);
  if (!other) return void fail(res, 404, "NOT_FOUND", "Member not found.");
  const business = get<{ id: string; name: string }>("SELECT id, name FROM businesses WHERE owner_id = ? LIMIT 1", [other.id]);

  let threadId = "";
  let wasCreated = false;
  transaction(() => {
    const ensured = ensureThread(me.id, other.id, {
      subject: subject || business?.name || `Conversation with ${other.name}`,
      businessId: business?.id,
    });
    threadId = ensured.id;
    wasCreated = ensured.created;
    if (text) postMessage(threadId, me.id, text);
  });

  const payload = { thread: toThreadView(threadId, me.id) };
  if (wasCreated) created(res, payload);
  else ok(res, payload);
});

const pageQuery = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});

messagesRouter.get("/threads/:id/messages", (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void fail(res, 404, "NOT_FOUND", "Conversation not found.");
  const { after, limit } = pageQuery.parse(req.query);
  const rows = after
    ? all<MessageRow>(
        "SELECT * FROM messages WHERE thread_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT ?",
        [req.params.id, after, limit],
      )
    : all<MessageRow>("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?", [
        req.params.id,
        limit,
      ]);
  ok(res, { thread: toThreadView(req.params.id, me), messages: rows.map(toMessageView) });
});

const sendSchema = z.object({
  text: cleanText(1, 4000, { min: "Write a message first.", max: "Keep messages under 4,000 characters." }),
});

messagesRouter.post("/threads/:id/messages", msgLimiter, (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void fail(res, 404, "NOT_FOUND", "Conversation not found.");
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return void fail(res, 400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid message.");
  }

  let msg: ReturnType<typeof postMessage> | undefined;
  transaction(() => {
    msg = postMessage(req.params.id, me, parsed.data.text);
    const other = get<{ user_id: string }>(
      "SELECT user_id FROM thread_participants WHERE thread_id = ? AND user_id != ? LIMIT 1",
      [req.params.id, me],
    );
    if (other) {
      pushNotification({
        userId: other.user_id,
        kind: "message",
        personId: me,
        title: `New message from ${req.user!.name}`,
        body: parsed.data.text.slice(0, 140),
        actionLabel: "Reply",
        href: `/messages?thread=${req.params.id}`,
      });
    }
  });
  created(res, { message: msg });
});

messagesRouter.post("/threads/:id/read", (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void fail(res, 404, "NOT_FOUND", "Conversation not found.");
  run("UPDATE thread_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?", [nowIso(), req.params.id, me]);
  res.status(204).end();
});
