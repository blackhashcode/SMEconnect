import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { createSession, destroySession, hashPassword, loadSessionUser, rateLimit, verifyPassword } from "../auth.ts";
import { get, run, transaction } from "../db.ts";
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  // Keyed on the account being tried (normalised the same way the schema does),
  // so " Victim@x.com " can't dodge the limit. Not keyed on IP: every request
  // arrives via the Next.js proxy, and client-supplied X-Forwarded-For can't be trusted.
  key: (req) => String(req.body?.email ?? "").trim().toLowerCase(),
});

/** URL-safe id from a name plus a short random suffix, e.g. "ayesha-rahman-3f9a". */
function makeId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "member"}-${crypto.randomBytes(2).toString("hex")}`;
}

const joinedLabel = () => new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

authRouter.post("/signup", limiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please fix the highlighted fields.", fields: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const data = parsed.data;

  if (get("SELECT 1 FROM users WHERE email = ?", [data.email])) {
    res.status(409).json({ error: "An account with this email already exists.", fields: { email: ["This email is already registered. Try logging in."] } });
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const userId = makeId(data.name);
  const location = data.location || "Bangladesh";
  const isBusiness = data.role === "business";

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
        "", // No photo yet: the front end shows the member's initials.
        "", // No cover yet: the front end shows a neutral gradient.
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
  });

  createSession(res, userId);
  res.status(201).json({ user: loadSessionUser(userId) });
});

authRouter.post("/login", limiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your email and password.", fields: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const row = get<Pick<UserRow, "id" | "password_hash">>("SELECT id, password_hash FROM users WHERE email = ?", [parsed.data.email]);
  const ok = await verifyPassword(parsed.data.password, row?.password_hash);
  if (!row || !ok) {
    // Same message either way, so the form doesn't reveal which emails exist.
    res.status(401).json({ error: "That email and password don't match." });
    return;
  }
  createSession(res, row.id);
  res.json({ user: loadSessionUser(row.id) });
});

authRouter.post("/logout", (req, res) => {
  destroySession(req, res);
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not logged in." });
    return;
  }
  res.json({ user: req.user });
});
