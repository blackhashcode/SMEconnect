import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/server/db";

/**
 * Bootstraps the first administrator account. This is the only data the seed
 * creates: every other account signs up through the app. Safe to re-run.
 *
 *   ADMIN_EMAIL     required
 *   ADMIN_PASSWORD  required, 12+ characters (only used when creating the account)
 *   ADMIN_NAME      optional, defaults to "SME Connect Admin"
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "SME Connect Admin";

  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Set ADMIN_EMAIL to the administrator's email address");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== "ADMIN") {
      throw new Error(`${email} already belongs to a non-admin account; choose another ADMIN_EMAIL`);
    }
    console.log(`Admin account ${email} already exists; nothing to do.`);
    return;
  }

  if (password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD (at least 12 characters) to create the admin account");
  }

  const now = new Date();
  const userId = randomUUID();
  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    }),
    prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);
  console.log(`Created admin account ${email}. You can now sign in at /login.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
