import { describe, expect, it } from "vitest";
import { buildRepaymentSchedule } from "@/server/services/repayment-schedule";
import {
  buildDemoDataset,
  DEMO_PASSWORD_DEFAULT,
  PERSONAL_EMAIL_DEFAULT,
  seedConfigFromEnv,
} from "@/server/seed/demo-data";
import {
  privateFileUrlSchema,
  publicFileUrlSchema,
} from "@/server/validators/storage";

function env(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

const config = seedConfigFromEnv(env());
const dataset = buildDemoDataset(config);

function ids<T extends { id: string }>(rows: T[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function expectAllKnown(rows: Array<string | null | undefined>, known: Set<string>) {
  for (const value of rows) {
    if (value !== null && value !== undefined) expect(known.has(value)).toBe(true);
  }
}

describe("seed configuration", () => {
  it("uses the documented defaults", () => {
    expect(config.demoPassword).toBe(DEMO_PASSWORD_DEFAULT);
    expect(config.usesDefaultPassword).toBe(true);
    expect(config.personalEmail).toBe(PERSONAL_EMAIL_DEFAULT);
    expect(config.adminEmail).toBe("admin@smeconnect.local");
  });

  it("normalizes configured emails and rejects invalid combinations", () => {
    const custom = seedConfigFromEnv(
      env({
        SEED_ADMIN_EMAIL: " Admin@Example.COM ",
        SEED_PERSONAL_EMAIL: "Owner@Example.com",
        SEED_DEMO_PASSWORD: "custom-password",
      }),
    );
    expect(custom.adminEmail).toBe("admin@example.com");
    expect(custom.personalEmail).toBe("owner@example.com");
    expect(custom.usesDefaultPassword).toBe(false);

    expect(() => seedConfigFromEnv(env({ SEED_ANCHOR_DATE: "not-a-date" }))).toThrow(
      /SEED_ANCHOR_DATE/,
    );
    expect(() => seedConfigFromEnv(env({ SEED_DEMO_PASSWORD: "short" }))).toThrow(
      /SEED_DEMO_PASSWORD/,
    );
    expect(() =>
      seedConfigFromEnv(
        env({
          SEED_ADMIN_EMAIL: "same@example.com",
          SEED_PERSONAL_EMAIL: "SAME@example.com",
        }),
      ),
    ).toThrow(/must be different/);
  });
});

describe("demo dataset", () => {
  it("is deterministic for the same configuration", () => {
    expect(buildDemoDataset(config)).toEqual(dataset);
  });

  it("has one admin, ten owners and six investors", () => {
    expect(dataset.users.filter((user) => user.role === "ADMIN")).toHaveLength(1);
    expect(dataset.users.filter((user) => user.role === "OWNER")).toHaveLength(10);
    expect(dataset.users.filter((user) => user.role === "INVESTOR")).toHaveLength(6);
    expect(ids(dataset.users).size).toBe(dataset.users.length);
  });

  it("uses the personal email exactly once on an owner account", () => {
    const personalUsers = dataset.users.filter(
      (user) => user.email === config.personalEmail,
    );
    expect(personalUsers).toHaveLength(1);
    expect(personalUsers[0]).toMatchObject({
      name: "Md. Fahim Bin Imam Nahid",
      role: "OWNER",
    });
    expect(
      dataset.users.some(
        (user) =>
          user.role !== "OWNER" &&
          (user.email === config.personalEmail || user.name.includes("Nahid")),
      ),
    ).toBe(false);
    for (const user of dataset.users) {
      if (user.email !== config.personalEmail) {
        expect(user.email.endsWith("@smeconnect.local")).toBe(true);
      }
    }
  });

  it("uses approved name variations naturally across related records", () => {
    const personalOwner = dataset.users.find(
      (user) => user.email === config.personalEmail,
    );
    expect(personalOwner).toBeDefined();
    const ownerId = personalOwner?.id ?? "";

    expect(
      dataset.businessProfiles.find((row) => row.ownerId === ownerId)?.description,
    ).toContain("Md. Fahim Bin Imam Nahid");
    expect(
      dataset.posts.some((post) => post.content.includes("Fahim Bin Imam")),
    ).toBe(true);
    expect(
      dataset.reviews.some((review) =>
        review.comment.includes("Fahim Bin Imam"),
      ),
    ).toBe(true);
    expect(
      dataset.connections.some((connection) =>
        connection.message?.includes("Md. Fahim Bin Imam Nahid"),
      ),
    ).toBe(true);
  });

  it("includes every loan request and offer status", () => {
    expect(new Set(dataset.loanRequests.map((row) => row.status))).toEqual(
      new Set([
        "DRAFT",
        "OPEN",
        "IN_DISCUSSION",
        "FUNDED",
        "REPAYING",
        "COMPLETED",
        "PAUSED",
        "CANCELLED",
      ]),
    );
    expect(new Set(dataset.offers.map((row) => row.status))).toEqual(
      new Set(["PENDING", "ACCEPTED", "REJECTED", "COUNTERED", "WITHDRAWN", "EXPIRED"]),
    );
  });

  it("keeps at most one active loan request per owner", () => {
    const activeStatuses = new Set(["OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING"]);
    const owners = dataset.loanRequests
      .filter((row) => activeStatuses.has(row.status))
      .map((row) => row.ownerId);
    expect(new Set(owners).size).toBe(owners.length);
  });

  it("builds a valid counter-offer chain and unique pending offers", () => {
    const chain = ["off_disc_01", "off_disc_02", "off_disc_03"];
    const offers = chain.map(
      (id) => dataset.offers.find((offer) => offer.id === id) ?? never(),
    );
    expect(offers.map((offer) => offer.status)).toEqual([
      "COUNTERED",
      "COUNTERED",
      "PENDING",
    ]);
    expect(offers.map((offer) => offer.parentOfferId)).toEqual([
      null,
      "off_disc_01",
      "off_disc_02",
    ]);
    expect(offers.map((offer) => offer.proposedBy)).toEqual([
      "INVESTOR",
      "OWNER",
      "INVESTOR",
    ]);

    const pendingKeys = dataset.offers
      .filter((offer) => offer.status === "PENDING")
      .map((offer) => `${offer.loanRequestId}:${offer.investorId}`);
    expect(new Set(pendingKeys).size).toBe(pendingKeys.length);
  });

  it("creates one active loan with mixed repayment states and a reviewed completed loan", () => {
    const repaying = dataset.repayments.filter(
      (row) => row.loanId === "loan_repaying_05",
    );
    expect(new Set(repaying.map((row) => row.status))).toEqual(
      new Set(["CONFIRMED", "OVERDUE", "MARKED_PAID", "UPCOMING"]),
    );

    const completed = dataset.repayments.filter(
      (row) => row.loanId === "loan_completed_01",
    );
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((row) => row.status === "CONFIRMED")).toBe(true);
    expect(dataset.reviews.length).toBe(2);
    expect(
      dataset.reviews.every((review) => review.loanId === "loan_completed_01"),
    ).toBe(true);
    expect(dataset.reports.some((report) => report.status === "OPEN")).toBe(true);
  });

  it("derives loan totals and installment sums with the production formula", () => {
    for (const loan of dataset.loans) {
      const schedule = buildRepaymentSchedule({
        principalBdt: loan.principalBdt,
        interestRatePct: loan.interestRatePct,
        tenureDays: loan.tenureDays,
        repaymentFrequency: loan.repaymentFrequency,
        startDate: loan.startDate ?? config.anchor,
      });
      expect(loan.totalRepayableBdt).toBe(schedule.totalRepayableBdt);
      const installmentCount = dataset.repayments.filter(
        (row) => row.loanId === loan.id,
      ).length;
      // A loan awaiting agreement confirmation has no schedule yet.
      if (loan.status === "PENDING_AGREEMENT") {
        expect(installmentCount).toBe(0);
        continue;
      }
      expect(schedule.installments).toHaveLength(installmentCount);
    }

    for (const loanId of ["loan_completed_01", "loan_repaying_05"]) {
      const loan = dataset.loans.find((row) => row.id === loanId) ?? never();
      const sum = dataset.repayments
        .filter((row) => row.loanId === loanId)
        .reduce((total, row) => total + row.amountBdt, 0);
      expect(sum).toBe(loan.totalRepayableBdt);
    }
  });

  it("satisfies numeric, URL and relationship constraints", () => {
    const userIds = ids(dataset.users);
    const requestIds = ids(dataset.loanRequests);
    const offerIds = ids(dataset.offers);
    const loanIds = ids(dataset.loans);
    const postIds = ids(dataset.posts);
    const commentIds = ids(dataset.comments);
    const messageIds = ids(dataset.messages);
    const businessIds = ids(dataset.businessProfiles);

    expectAllKnown(
      dataset.verifications.flatMap((row) => [row.userId, row.reviewerId]),
      userIds,
    );
    expectAllKnown(dataset.businessProfiles.map((row) => row.ownerId), userIds);
    expectAllKnown(dataset.productImages.map((row) => row.businessProfileId), businessIds);
    expectAllKnown(dataset.investorProfiles.map((row) => row.userId), userIds);
    expectAllKnown(dataset.loanRequests.map((row) => row.ownerId), userIds);
    expectAllKnown(
      dataset.offers.flatMap((row) => [row.loanRequestId, row.investorId, row.parentOfferId]),
      new Set([...requestIds, ...userIds, ...offerIds]),
    );
    expectAllKnown(
      dataset.loans.flatMap((row) => [
        row.loanRequestId,
        row.offerId,
        row.ownerId,
        row.investorId,
      ]),
      new Set([...requestIds, ...offerIds, ...userIds]),
    );
    expectAllKnown(dataset.agreements.map((row) => row.loanId), loanIds);
    expectAllKnown(dataset.repayments.map((row) => row.loanId), loanIds);
    expectAllKnown(
      dataset.posts.flatMap((row) => [row.authorId, row.loanRequestId]),
      new Set([...userIds, ...requestIds]),
    );
    expectAllKnown(
      dataset.comments.flatMap((row) => [row.postId, row.authorId]),
      new Set([...postIds, ...userIds]),
    );
    expectAllKnown(
      dataset.likes.flatMap((row) => [row.postId, row.userId]),
      new Set([...postIds, ...userIds]),
    );
    expectAllKnown(
      dataset.follows.flatMap((row) => [row.followerId, row.followeeId]),
      userIds,
    );
    expect(dataset.follows.every((row) => row.followerId !== row.followeeId)).toBe(true);
    expectAllKnown(
      dataset.connections.flatMap((row) => [row.requesterId, row.addresseeId]),
      userIds,
    );
    expect(
      dataset.connections.every((row) => row.requesterId !== row.addresseeId),
    ).toBe(true);
    expectAllKnown(
      dataset.conversations.flatMap((row) => [row.participantOneId, row.participantTwoId]),
      userIds,
    );
    expect(
      dataset.conversations.every(
        (row) => row.participantOneId < row.participantTwoId,
      ),
    ).toBe(true);
    expectAllKnown(
      dataset.messages.flatMap((row) => [row.conversationId, row.senderId]),
      new Set([...ids(dataset.conversations), ...userIds]),
    );
    expectAllKnown(
      dataset.messageDeletions.flatMap((row) => [row.messageId, row.userId]),
      new Set([...messageIds, ...userIds]),
    );
    expectAllKnown(dataset.notifications.map((row) => row.userId), userIds);
    expectAllKnown(
      dataset.reviews.flatMap((row) => [row.loanId, row.reviewerId, row.revieweeId]),
      new Set([...loanIds, ...userIds]),
    );
    expectAllKnown(
      dataset.reports.flatMap((row) => [row.reporterId, row.handledById]),
      userIds,
    );
    const reportTargets: Record<string, Set<string>> = {
      USER: userIds,
      POST: postIds,
      COMMENT: commentIds,
      MESSAGE: messageIds,
    };
    for (const report of dataset.reports) {
      expect(reportTargets[report.targetType], report.id).toBeDefined();
      expect(reportTargets[report.targetType]?.has(report.targetId), report.id).toBe(true);
    }
    expectAllKnown(
      dataset.blocks.flatMap((row) => [row.blockerId, row.blockedId]),
      userIds,
    );
    expect(
      dataset.blocks.every((row) => row.blockerId !== row.blockedId),
    ).toBe(true);

    for (const business of dataset.businessProfiles) {
      expect(business.monthlySalesMinBdt).toBeLessThanOrEqual(
        business.monthlySalesMaxBdt,
      );
    }
    for (const investor of dataset.investorProfiles) {
      expect(investor.minLendBdt).toBeLessThanOrEqual(investor.maxLendBdt);
      expect(investor.preferredRatePctMin <= investor.preferredRatePctMax).toBe(true);
    }
    for (const review of dataset.reviews) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
    for (const repayment of dataset.repayments) {
      expect(repayment.amountBdt).toBeGreaterThan(0);
      if (repayment.proofUrl) {
        expect(privateFileUrlSchema.parse(repayment.proofUrl)).toBe(repayment.proofUrl);
      }
    }
    for (const post of dataset.posts) {
      for (const url of post.imageUrls) {
        expect(publicFileUrlSchema.parse(url)).toBe(url);
      }
    }
  });

  it("satisfies every unique constraint declared in the schema", () => {
    const expectUnique = (values: unknown[], label: string) => {
      const keys = values.map((value) =>
        typeof value === "object" ? JSON.stringify(value) : value,
      );
      expect(new Set(keys).size, label).toBe(values.length);
    };
    const unorderedPair = (first: string, second: string) =>
      [first, second].sort().join(":");

    expectUnique(dataset.users.map((row) => row.id), "user.id");
    expectUnique(dataset.users.map((row) => row.email), "user.email");
    expectUnique(dataset.users.map((row) => row.phone), "user.phone");
    expectUnique(dataset.accounts.map((row) => row.id), "account.id");
    expectUnique(
      dataset.accounts.map((row) => [row.providerId, row.accountId]),
      "account.providerId+accountId",
    );
    expectUnique(
      dataset.verifications.map((row) => [row.userId, row.type]),
      "userVerification.userId+type",
    );
    expectUnique(dataset.businessProfiles.map((row) => row.ownerId), "businessProfile.ownerId");
    expectUnique(dataset.businessProfiles.map((row) => row.slug), "businessProfile.slug");
    expectUnique(
      dataset.productImages.map((row) => [row.businessProfileId, row.position]),
      "productImage.businessProfileId+position",
    );
    expectUnique(dataset.investorProfiles.map((row) => row.userId), "investorProfile.userId");
    expectUnique(
      dataset.loanRequests
        .filter((row) => ["OPEN", "IN_DISCUSSION", "FUNDED", "REPAYING"].includes(row.status))
        .map((row) => row.ownerId),
      "one active loan request per owner",
    );
    expectUnique(
      dataset.offers
        .filter((row) => row.status === "PENDING")
        .map((row) => [row.loanRequestId, row.investorId]),
      "one pending offer per investor per request",
    );
    expectUnique(dataset.loans.map((row) => row.loanRequestId), "loan.loanRequestId");
    expectUnique(dataset.loans.map((row) => row.offerId), "loan.offerId");
    expectUnique(dataset.agreements.map((row) => row.loanId), "agreement.loanId");
    expectUnique(
      dataset.repayments.map((row) => [row.loanId, row.installmentNo]),
      "repayment.loanId+installmentNo",
    );
    expectUnique(dataset.posts.map((row) => row.id), "post.id");
    expectUnique(
      dataset.likes.map((row) => [row.postId, row.userId]),
      "like.postId+userId",
    );
    expectUnique(
      dataset.follows.map((row) => [row.followerId, row.followeeId]),
      "follow.followerId+followeeId",
    );
    expectUnique(
      dataset.connections.map((row) => [row.requesterId, row.addresseeId]),
      "connection.requesterId+addresseeId",
    );
    expectUnique(
      dataset.connections.map((row) => unorderedPair(row.requesterId, row.addresseeId)),
      "connection.pair",
    );
    expectUnique(
      dataset.conversations.map((row) => unorderedPair(row.participantOneId, row.participantTwoId)),
      "conversation.pair",
    );
    expectUnique(
      dataset.messageDeletions.map((row) => [row.messageId, row.userId]),
      "messageDeletion.messageId+userId",
    );
    expectUnique(
      dataset.reviews.map((row) => [row.loanId, row.reviewerId]),
      "review.loanId+reviewerId",
    );
    expectUnique(
      dataset.blocks.map((row) => [row.blockerId, row.blockedId]),
      "block.blockerId+blockedId",
    );
  });
});

function never(): never {
  throw new Error("Expected demo record not found");
}
