import { Router } from "express";
import { z } from "zod";
import { all, get, run } from "../db.ts";
import { ensureThread, postMessage } from "../messaging.ts";
import { cleanText } from "../text.ts";
import { isParticipant, nowIso, threadsFor, toMessageView, toThreadView, type MessageRow } from "../views.ts";

/** One-to-one conversations between members. Mounted behind requireAuth. */
export const messagesRouter = Router();

messagesRouter.get("/threads", (req, res) => {
  const threads = threadsFor(req.user!.id);
  res.json({ threads, unread: threads.reduce((sum, thread) => sum + thread.unread, 0) });
});

/** Total unread messages, for the header badge. */
messagesRouter.get("/threads/unread-count", (req, res) => {
  const me = req.user!.id;
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages m JOIN thread_participants p ON p.thread_id = m.thread_id AND p.user_id = ?
     WHERE m.sender_id != ? AND m.created_at > p.last_read_at`,
    [me, me],
  );
  res.json({ unread: row?.n ?? 0 });
});

const startSchema = z.object({
  participantId: z.string().min(1).max(80),
  subject: cleanText(0, 120).optional(),
  text: cleanText(0, 4000).optional(),
});

/** Opens (or reuses) a conversation with another member, optionally sending a first message. */
messagesRouter.post("/threads", (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Choose who to message." });
  const me = req.user!;
  const { participantId, subject, text } = parsed.data;
  if (participantId === me.id) return void res.status(400).json({ error: "You can't message yourself." });

  const other = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE id = ? AND role != 'admin'", [participantId]);
  if (!other) return void res.status(404).json({ error: "Member not found." });
  const business = get<{ id: string; name: string }>("SELECT id, name FROM businesses WHERE owner_id = ? LIMIT 1", [other.id]);

  const { id: threadId, created } = ensureThread(me.id, other.id, { subject: subject || business?.name || `Conversation with ${other.name}`, businessId: business?.id });
  if (text) postMessage(threadId, me.id, text);
  // 201 for a brand-new conversation, 200 when an existing one is reused.
  res.status(created ? 201 : 200).json({ thread: toThreadView(threadId, me.id) });
});

const pageQuery = z.object({ after: z.string().datetime().optional() });

messagesRouter.get("/threads/:id/messages", (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void res.status(404).json({ error: "Conversation not found." });
  const { after } = pageQuery.parse(req.query);
  const rows = after
    ? all<MessageRow>("SELECT * FROM messages WHERE thread_id = ? AND created_at > ? ORDER BY created_at ASC", [req.params.id, after])
    : all<MessageRow>("SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC", [req.params.id]);
  res.json({ thread: toThreadView(req.params.id, me), messages: rows.map(toMessageView) });
});

const sendSchema = z.object({ text: cleanText(1, 4000, { min: "Write a message first.", max: "Keep messages under 4,000 characters." }) });

messagesRouter.post("/threads/:id/messages", (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void res.status(404).json({ error: "Conversation not found." });
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid message." });
  res.status(201).json({ message: postMessage(req.params.id, me, parsed.data.text) });
});

/** Marks everything in the conversation as read for the current member. */
messagesRouter.post("/threads/:id/read", (req, res) => {
  const me = req.user!.id;
  if (!isParticipant(req.params.id, me)) return void res.status(404).json({ error: "Conversation not found." });
  run("UPDATE thread_participants SET last_read_at = ? WHERE thread_id = ? AND user_id = ?", [nowIso(), req.params.id, me]);
  res.status(204).end();
});
