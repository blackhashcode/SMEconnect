import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { createSession, destroySession, hashPassword, loadSessionUser, rateLimit, verifyPassword } from "../auth.ts";
import { get, recordAudit, run, transaction } from "../db.ts";
import { created, fail, ok } from "../http.ts";
import type { UserRow } from "../models.ts";

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email,
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    role: z.enum(["business", "investor"]),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+\d\s-]*$/, "Use digits, spaces, + or - only.")
      .optional()
      .or(z.literal("")),
    businessName: z.string().trim().max(80).optional(),
    category: z.string().trim().max(60).optional(),
    location: z.string().trim().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "business" && (!data.businessName || data.businessName.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["businessName"], message: "Enter your business name." });
    }
  });

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `acct:${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  key: (req) => `ip:${req.socket.remoteAddress ?? "local"}`,
});

function makeId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${slug || "member"}-${crypto.randomUUID().slice(0, 8)}`;
}

const joinedLabel = () => new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

authRouter.post("/signup", ipLimiter, accountLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
    return;
  }
  const data = parsed.data;

  if (get("SELECT 1 FROM users WHERE email = ?", [data.email])) {
    fail(res, 409, "CONFLICT", "An account with this email already exists.", {
      fieldErrors: { email: ["This email is already registered. Try logging in."] },
    });
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const userId = makeId(data.name);
  const location = data.location || "Bangladesh";
  const isBusiness = data.role === "business";

  try {
    transaction(() => {
      run(
        `INSERT INTO users (id, email, password_hash, name, role, phone, headline, location, avatar, cover, about, joined)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          data.email,
          passwordHash,
          data.name,
          data.role,
          data.phone || null,
          isBusiness ? `Founder at ${data.businessName}` : "Investor on SME Connect",
          location,
          "",
          "",
          isBusiness
            ? `I run ${data.businessName}. My profile is new — verification is in progress.`
            : "New to SME Connect and looking to connect with verified local businesses.",
          joinedLabel(),
        ],
      );
      if (isBusiness) {
        run(
          `INSERT INTO businesses (id, owner_id, name, category, tagline, location, founded, image, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            makeId(data.businessName!),
            userId,
            data.businessName!,
            data.category || "General",
            "New on SME Connect",
            location,
            String(new Date().getFullYear()),
            "",
            `${data.businessName} recently joined SME Connect. More details will appear once the owner completes their profile.`,
          ],
        );
      }
      // Automatically create a pending verification case so admins can review & approve.
      run(
        `INSERT INTO verifications (id, person_id, business_name, type, nid, trade_license, documents, risk, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'low', 'pending', ?)`,
        [
          `vc-${crypto.randomUUID().slice(0, 8)}`,
          userId,
          isBusiness ? data.businessName! : "Individual Investor",
          isBusiness ? "Business" : "Investor",
          "Pending upload",
          isBusiness ? "Pending upload" : "N/A",
          JSON.stringify(["Account application"]),
          new Date().toISOString(),
        ],
      );
      recordAudit(userId, "USER_SIGNED_UP", "User", userId, { role: data.role });
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      fail(res, 409, "CONFLICT", "An account with this email already exists.", {
        fieldErrors: { email: ["This email is already registered. Try logging in."] },
      });
      return;
    }
    throw err;
  }

  createSession(res, userId);
  created(res, { user: loadSessionUser(userId) });
});

authRouter.post("/login", ipLimiter, accountLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, "VALIDATION_ERROR", "Enter your email and password.", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    });
    return;
  }
  const row = get<Pick<UserRow, "id" | "password_hash">>("SELECT id, password_hash FROM users WHERE email = ?", [
    parsed.data.email,
  ]);
  const okPass = await verifyPassword(parsed.data.password, row?.password_hash);
  if (!row || !okPass) {
    fail(res, 401, "UNAUTHORIZED", "That email and password don't match.");
    return;
  }
  createSession(res, row.id);
  ok(res, { user: loadSessionUser(row.id) });
});

authRouter.post("/logout", (req, res) => {
  destroySession(req, res);
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  if (!req.user) {
    fail(res, 401, "UNAUTHORIZED", "Not logged in.");
    return;
  }
  ok(res, { user: req.user });
});
