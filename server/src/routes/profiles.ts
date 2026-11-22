import { Router } from "express";
import { z } from "zod";
import { all, get } from "../db.ts";
import { toBusiness, toPerson, type BusinessRow, type UserRow } from "../models.ts";

/** Member directory: people and businesses. Mounted behind requireAuth. */
export const profilesRouter = Router();

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["business", "investor"]).optional(),
  category: z.string().trim().max(60).optional(),
});

// Escape LIKE wildcards so a search for "100%" matches literally.
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

profilesRouter.get("/users", (req, res) => {
  const { q, role } = listQuery.parse(req.query);
  const where: string[] = ["role != 'admin'"];
  const params: string[] = [];
  if (role) {
    where.push("role = ?");
    params.push(role);
  }
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR headline LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\')");
    params.push(like(q), like(q), like(q));
  }
  const rows = all<UserRow>(`SELECT * FROM users WHERE ${where.join(" AND ")} ORDER BY verified DESC, created_at ASC`, params);
  res.json({ users: rows.map(toPerson) });
});

profilesRouter.get("/users/:id", (req, res) => {
  const row = get<UserRow>("SELECT * FROM users WHERE id = ? AND role != 'admin'", [req.params.id]);
  if (!row) {
    res.status(404).json({ error: "Member not found." });
    return;
  }
  const business = get<BusinessRow>("SELECT * FROM businesses WHERE owner_id = ? LIMIT 1", [row.id]);
  res.json({ user: toPerson(row), business: business ? toBusiness(business) : null });
});

profilesRouter.get("/businesses", (req, res) => {
  const { q, category } = listQuery.parse(req.query);
  const where: string[] = [];
  const params: string[] = [];
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR tagline LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
    params.push(like(q), like(q), like(q), like(q));
  }
  const sql = `SELECT * FROM businesses ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY verified DESC, rowid ASC`;
  res.json({ businesses: all<BusinessRow>(sql, params).map(toBusiness) });
});

profilesRouter.get("/businesses/:id", (req, res) => {
  const business = get<BusinessRow>("SELECT * FROM businesses WHERE id = ?", [req.params.id]);
  if (!business) {
    res.status(404).json({ error: "Business not found." });
    return;
  }
  const owner = get<UserRow>("SELECT * FROM users WHERE id = ?", [business.owner_id]);
  res.json({ business: toBusiness(business), owner: owner ? toPerson(owner) : null });
});
