import { Router } from "express";
import { z } from "zod";
import { all, get } from "../db.ts";
import { fail, ok } from "../http.ts";
import { toBusiness, toPeople, toPerson, type BusinessRow, type UserRow } from "../models.ts";

export const profilesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["business", "investor"]).optional(),
  category: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

profilesRouter.get("/users", (req, res) => {
  const { q, role, limit } = listQuery.parse(req.query);
  const where: string[] = ["role != 'admin'"];
  const params: (string | number)[] = [];
  if (role) {
    where.push("role = ?");
    params.push(role);
  }
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR headline LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')");
    params.push(like(q), like(q), like(q));
  }
  params.push(limit);
  const rows = all<UserRow>(
    `SELECT * FROM users WHERE ${where.join(" AND ")} ORDER BY verified DESC, created_at ASC LIMIT ?`,
    params,
  );
  ok(res, { users: toPeople(rows) }, { limit, count: rows.length });
});

profilesRouter.get("/users/:id", (req, res) => {
  const row = get<UserRow>("SELECT * FROM users WHERE id = ? AND role != 'admin'", [req.params.id]);
  if (!row) {
    fail(res, 404, "NOT_FOUND", "Member not found.");
    return;
  }
  const business = get<BusinessRow>("SELECT * FROM businesses WHERE owner_id = ? LIMIT 1", [row.id]);
  ok(res, { user: toPerson(row), business: business ? toBusiness(business) : null });
});

profilesRouter.get("/businesses", (req, res) => {
  const { q, category, limit } = listQuery.parse(req.query);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (category) {
    where.push("category = ? COLLATE NOCASE");
    params.push(category);
  }
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR tagline LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
    params.push(like(q), like(q), like(q), like(q));
  }
  params.push(limit);
  const sql = `SELECT * FROM businesses ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY verified DESC, rowid ASC LIMIT ?`;
  const rows = all<BusinessRow>(sql, params);
  ok(res, { businesses: rows.map(toBusiness) }, { limit, count: rows.length });
});

profilesRouter.get("/businesses/:id", (req, res) => {
  const business = get<BusinessRow>("SELECT * FROM businesses WHERE id = ?", [req.params.id]);
  if (!business) {
    fail(res, 404, "NOT_FOUND", "Business not found.");
    return;
  }
  const owner = get<UserRow>("SELECT * FROM users WHERE id = ?", [business.owner_id]);
  ok(res, { business: toBusiness(business), owner: owner ? toPerson(owner) : null });
});
