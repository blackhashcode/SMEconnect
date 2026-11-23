import "dotenv/config";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { recomputeTrustScore, type TrustScoreDb } from "@/server/services/trust-score";
import {
  buildDemoDataset,
  DEMO_PASSWORD_DEFAULT,
  seedConfigFromEnv,
  type DemoDataset,
  type SeedConfig,
} from "@/server/seed/demo-data";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function assertUniqueDatasetValues(dataset: DemoDataset): void {
  const emails = dataset.users.map((user) => user.email);
  const phones = dataset.users.map((user) => user.phone);
  if (new Set(emails).size !== emails.length) {
    throw new Error("Demo dataset contains duplicate email addresses");
  }
  if (new Set(phones).size !== phones.length) {
    throw new Error("Demo dataset contains duplicate phone numbers");
  }
}

async function assertNoForeignCollisions(dataset: DemoDataset): Promise<void> {
  const seedIds = new Set(dataset.users.map((user) => user.id));
  const collisions = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: dataset.users.map((user) => user.email) } },
        { phone: { in: dataset.users.map((user) => user.phone) } },
      ],
    },
    select: { id: true },
  });
  const foreign = collisions.filter((user) => !seedIds.has(user.id));
  if (foreign.length > 0) {
    throw new Error(
      `${foreign.length} existing non-demo user(s) already use seed email/phone values; ` +
        "remove them or change SEED_ADMIN_EMAIL / SEED_PERSONAL_EMAIL before seeding",
    );
  }
}

async function upsertPassword(
  tx: Prisma.TransactionClient,
  accountId: string,
  userId: string,
  passwordHash: string,
  demoPassword: string,
  createdAt: Date,
  updatedAt: Date,
): Promise<void> {
  const existing = await tx.account.findUnique({ where: { id: accountId } });
  let alreadyValid = false;
  if (existing?.password) {
    try {
      alreadyValid = await verifyPassword({
        hash: existing.password,
        password: demoPassword,
      });
    } catch {
      alreadyValid = false;
    }
  }

  await tx.account.upsert({
    where: { id: accountId },
    create: {
      id: accountId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
      userId,
      createdAt,
      updatedAt: createdAt,
    },
    update: alreadyValid
      ? { accountId: userId, providerId: "credential", updatedAt }
      : {
          accountId: userId,
          providerId: "credential",
          password: passwordHash,
          updatedAt,
        },
  });
}

async function writeDataset(
  config: SeedConfig,
  dataset: DemoDataset,
  passwordHash: string,
): Promise<void> {
  const anchor = config.anchor;

  await prisma.$transaction(async (tx) => {
    for (const user of dataset.users) {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          ...user,
          createdAt: addDays(anchor, -200),
          updatedAt: addDays(anchor, -200),
        },
        update: {
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          phone: user.phone,
          phoneVerified: user.phoneVerified,
          role: user.role,
          status: user.status,
          createdAt: addDays(anchor, -200),
          updatedAt: anchor,
        },
      });
    }

    for (const account of dataset.accounts) {
      await upsertPassword(
        tx,
        account.id,
        account.userId,
        passwordHash,
        config.demoPassword,
        addDays(anchor, -200),
        anchor,
      );
    }

    for (const row of dataset.verifications) {
      await tx.userVerification.upsert({
        where: { id: row.id },
        create: { ...row, createdAt: row.submittedAt, updatedAt: row.submittedAt },
        update: { ...row, createdAt: row.submittedAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.businessProfiles) {
      const createdAt = addDays(anchor, -180);
      await tx.businessProfile.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.productImages) {
      const createdAt = addDays(anchor, -120);
      await tx.productImage.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.investorProfiles) {
      const createdAt = addDays(anchor, -180);
      await tx.investorProfile.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.loanRequests) {
      const createdAt = row.publishedAt ?? addDays(anchor, -35);
      await tx.loanRequest.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.offers) {
      await tx.offer.upsert({
        where: { id: row.id },
        create: {
          ...row,
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
        },
        update: { ...row, createdAt: row.createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.loans) {
      const createdAt = row.startDate ?? addDays(anchor, -7);
      await tx.loan.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.agreements) {
      const createdAt = row.ownerConfirmedAt ?? addDays(anchor, -6);
      await tx.agreement.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.repayments) {
      const createdAt = addDays(row.dueDate, -30);
      await tx.repayment.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.posts) {
      const createdAt = row.deletedAt ?? addDays(anchor, -5);
      await tx.post.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.comments) {
      const createdAt = row.deletedAt ?? addDays(anchor, -3);
      await tx.comment.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.likes) {
      const createdAt = addDays(anchor, -3);
      await tx.like.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.follows) {
      const createdAt = addDays(anchor, -30);
      await tx.follow.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.connections) {
      const createdAt = addDays(anchor, -10);
      await tx.connection.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.conversations) {
      const createdAt = addDays(anchor, -35);
      await tx.conversation.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.messages) {
      const createdAt = row.readAt ?? addDays(anchor, -32);
      await tx.message.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.messageDeletions) {
      const createdAt = addDays(anchor, -1);
      await tx.messageDeletion.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt, deletedAt: createdAt },
        update: { messageId: row.messageId, userId: row.userId, updatedAt: anchor },
      });
    }

    for (const row of dataset.notifications) {
      const createdAt = row.readAt ?? addDays(anchor, -1);
      await tx.notification.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.reviews) {
      const createdAt = addDays(anchor, -2);
      await tx.review.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.reports) {
      const createdAt = addDays(anchor, -3);
      await tx.report.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const row of dataset.blocks) {
      const createdAt = addDays(anchor, -5);
      await tx.block.upsert({
        where: { id: row.id },
        create: { ...row, createdAt, updatedAt: createdAt },
        update: { ...row, createdAt, updatedAt: anchor },
      });
    }

    for (const user of dataset.users) {
      if (user.role === "ADMIN") continue;
      await recomputeTrustScore(user.id, user.role, tx as unknown as TrustScoreDb, anchor);
    }
  });
}

function printDemoLogins(config: SeedConfig, dataset: DemoDataset): void {
  const shops = new Map(dataset.businessProfiles.map((row) => [row.ownerId, row.shopName]));
  const investors = new Map(
    dataset.investorProfiles.map((row) => [
      row.userId,
      `৳${row.minLendBdt.toLocaleString("en-BD")}–৳${row.maxLendBdt.toLocaleString("en-BD")}`,
    ]),
  );

  console.log("\nDemo seed complete. No emails were sent.");
  console.log(
    config.usesDefaultPassword
      ? `Password for every demo account: ${DEMO_PASSWORD_DEFAULT}`
      : "Password for every demo account: value supplied via SEED_DEMO_PASSWORD (not printed)",
  );

  for (const user of dataset.users) {
    if (user.role === "ADMIN") {
      console.log(`ADMIN     ${user.email}`);
      continue;
    }
    if (user.role === "OWNER") {
      console.log(`OWNER     ${user.email}  — ${shops.get(user.id) ?? user.name}`);
      continue;
    }
    console.log(`INVESTOR  ${user.email}  — ${investors.get(user.id) ?? user.name}`);
  }
  console.log("");
}

async function main(): Promise<void> {
  const config = seedConfigFromEnv(process.env);
  const dataset = buildDemoDataset(config);
  assertUniqueDatasetValues(dataset);
  await assertNoForeignCollisions(dataset);

  const passwordHash = await hashPassword(config.demoPassword);
  await writeDataset(config, dataset, passwordHash);
  printDemoLogins(config, dataset);
}

main().catch((error: unknown) => {
  console.error(
    "Seed failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exit(1);
});
