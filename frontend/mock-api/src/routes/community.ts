import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "../auth.ts";
import { all, get, pushNotification, recordAudit, run, transaction } from "../db.ts";
import { created, fail, ok } from "../http.ts";
import { cleanText } from "../text.ts";
import { newId, nowIso } from "../views.ts";

export const communityRouter = Router();

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  key: (req) => `comm:${req.user?.id ?? "anon"}`,
});

// ---------- Connections ----------

communityRouter.get("/connections", (req, res) => {
  const me = req.user!.id;
  const rows = all<{ id: string; requester_id: string; addressee_id: string; status: string; created_at: string }>(
    "SELECT * FROM connections WHERE requester_id = ? OR addressee_id = ? ORDER BY created_at DESC",
    [me, me],
  );
  const connectedIds = rows
    .filter((r) => r.status === "ACCEPTED")
    .map((r) => (r.requester_id === me ? r.addressee_id : r.requester_id));
  ok(res, { connections: rows, connectedIds });
});

const connectSchema = z.object({ participantId: z.string().min(1).max(80) });

communityRouter.post("/connections", writeLimiter, (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return void fail(res, 400, "VALIDATION_ERROR", "Choose a member to connect with.");
  const me = req.user!;
  const targetId = parsed.data.participantId;
  if (targetId === me.id) return void fail(res, 400, "VALIDATION_ERROR", "You can't connect with yourself.");

  const target = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE id = ? AND role != 'admin'", [targetId]);
  if (!target) return void fail(res, 404, "NOT_FOUND", "Member not found.");

  const existing = get<{ id: string }>(
    "SELECT id FROM connections WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
    [me.id, targetId, targetId, me.id],
  );
  if (existing) {
    ok(res, { connected: true, id: existing.id });
    return;
  }

  const id = newId("conn");
  transaction(() => {
    run("INSERT INTO connections (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'ACCEPTED', ?)", [
      id,
      me.id,
      targetId,
      nowIso(),
    ]);
    run("UPDATE users SET connections = connections + 1 WHERE id IN (?, ?)", [me.id, targetId]);
    pushNotification({
      userId: targetId,
      kind: "connection",
      personId: me.id,
      title: `${me.name} connected with you`,
      body: "You are now connected and can message directly on SME Connect.",
      actionLabel: "View profile",
      href: me.role === "business" && me.businessId ? `/businesses/${me.businessId}` : `/investors/${me.id}`,
    });
    recordAudit(me.id, "CONNECTION_CREATED", "Connection", id, { targetId });
  });

  created(res, { connected: true, id });
});

communityRouter.delete("/connections/:participantId", writeLimiter, (req, res) => {
  const me = req.user!.id;
  const targetId = req.params.participantId;
  const existing = get<{ id: string }>(
    "SELECT id FROM connections WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)",
    [me, targetId, targetId, me],
  );
  if (!existing) {
    ok(res, { connected: false });
    return;
  }
  transaction(() => {
    run("DELETE FROM connections WHERE id = ?", [existing.id]);
    run("UPDATE users SET connections = MAX(0, connections - 1) WHERE id IN (?, ?)", [me, targetId]);
    recordAudit(me, "CONNECTION_REMOVED", "Connection", existing.id, { targetId });
  });
  ok(res, { connected: false });
});

// ---------- Notifications ----------

type NotificationRow = {
  id: string;
  user_id: string;
  kind: "offer" | "connection" | "message" | "system";
  person_id: string | null;
  title: string;
  body: string;
  action_label: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

communityRouter.get("/notifications", (req, res) => {
  const me = req.user!.id;
  const rows = all<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [me],
  );
  const notifications = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    personId: r.person_id ?? undefined,
    title: r.title,
    body: r.body,
    time: r.created_at,
    unread: r.read_at === null,
    actionLabel: r.action_label ?? undefined,
    href: r.href ?? undefined,
  }));
  const unread = notifications.filter((n) => n.unread).length;
  ok(res, { notifications, unread }, { unread });
});

communityRouter.post("/notifications/:id/read", (req, res) => {
  const me = req.user!.id;
  const existing = get<{ id: string }>("SELECT id FROM notifications WHERE id = ? AND user_id = ?", [req.params.id, me]);
  if (!existing) return void fail(res, 404, "NOT_FOUND", "Notification not found.");
  run("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ?", [nowIso(), req.params.id]);
  ok(res, { read: true });
});

communityRouter.post("/notifications/read-all", (req, res) => {
  run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [nowIso(), req.user!.id]);
  ok(res, { readAll: true });
});

// ---------- Admin Verifications ----------

type VerificationRow = {
  id: string;
  person_id: string;
  business_name: string;
  type: "Business" | "Investor";
  nid: string;
  trade_license: string;
  documents: string;
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  person_name: string;
  person_avatar: string;
  person_location: string;
};

communityRouter.get("/admin/verifications", (req, res) => {
  if (req.user!.role !== "admin") {
    return void fail(res, 403, "FORBIDDEN", "Admin access required.");
  }
  const rows = all<VerificationRow>(
    `SELECT v.*, u.name AS person_name, u.avatar AS person_avatar, u.location AS person_location
     FROM verifications v JOIN users u ON u.id = v.person_id
     ORDER BY CASE v.status WHEN 'pending' THEN 0 ELSE 1 END, v.submitted_at DESC`,
  );
  const cases = rows.map((r) => {
    let documents: string[] = [];
    try {
      const parsed = JSON.parse(r.documents);
      if (Array.isArray(parsed)) documents = parsed.filter((d): d is string => typeof d === "string");
    } catch {
      documents = [];
    }
    return {
      id: r.id,
      personId: r.person_id,
      personName: r.person_name,
      personAvatar: r.person_avatar,
      personLocation: r.person_location,
      businessName: r.business_name,
      type: r.type,
      submittedAt: r.submitted_at,
      nid: r.nid,
      tradeLicense: r.trade_license,
      documents,
      risk: r.risk,
      status: r.status,
      reviewNote: r.review_note ?? undefined,
    };
  });
  ok(res, { cases });
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: cleanText(0, 500).optional(),
});

communityRouter.post("/admin/verifications/:id/review", writeLimiter, (req, res) => {
  if (req.user!.role !== "admin") {
    return void fail(res, 403, "FORBIDDEN", "Admin access required.");
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return void fail(res, 400, "VALIDATION_ERROR", "Choose approved or rejected.");

  const row = get<{ id: string; person_id: string; business_name: string; status: string }>(
    "SELECT id, person_id, business_name, status FROM verifications WHERE id = ?",
    [req.params.id],
  );
  if (!row) return void fail(res, 404, "NOT_FOUND", "Verification case not found.");

  const { decision, note } = parsed.data;
  const approved = decision === "approved";

  transaction(() => {
    run("UPDATE verifications SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?", [
      decision,
      note ?? null,
      req.user!.id,
      nowIso(),
      row.id,
    ]);
    run("UPDATE users SET verified = ? WHERE id = ?", [approved ? 1 : 0, row.person_id]);
    run("UPDATE businesses SET verified = ? WHERE owner_id = ?", [approved ? 1 : 0, row.person_id]);
    pushNotification({
      userId: row.person_id,
      kind: "system",
      title: approved ? "Verification approved" : "Verification requires updates",
      body: approved
        ? `Your identity and records for ${row.business_name} are verified. You can now post loan requests and offers.`
        : `Your verification was not approved${note ? `: ${note}` : "."}`,
      actionLabel: "Open dashboard",
      href: "/feed",
    });
    recordAudit(req.user!.id, `VERIFICATION_${decision.toUpperCase()}`, "Verification", row.id, {
      personId: row.person_id,
      note: note ?? null,
    });
  });

  ok(res, { id: row.id, status: decision, reviewNote: note ?? null });
});
