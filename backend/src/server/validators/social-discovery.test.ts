import { describe, expect, it } from "vitest";
import {
  businessesQuerySchema,
  commentRecordSchema,
  connectionListQuerySchema,
  connectionRecordSchema,
  createCommentSchema,
  createPostSchema,
  discoveryBusinessSchema,
  discoveryInvestorSchema,
  feedQuerySchema,
  followResultSchema,
  investorsQuerySchema,
  postRecordSchema,
  updatePostSchema,
} from "@/server/validators";

describe("social input validators", () => {
  it("only allows user-authored post types", () => {
    expect(createPostSchema.safeParse({ type: "UPDATE", content: "hello" }).success).toBe(true);
    expect(createPostSchema.safeParse({ type: "MILESTONE", content: "hi" }).success).toBe(true);
    expect(createPostSchema.safeParse({ type: "LOAN_REQUEST", content: "hi" }).success).toBe(
      false,
    );
    expect(createPostSchema.safeParse({ type: "REPAYMENT", content: "hi" }).success).toBe(false);
    expect(createPostSchema.safeParse({ type: "UPDATE", content: "" }).success).toBe(false);
  });

  it("caps image uploads and rejects unknown fields", () => {
    expect(
      createPostSchema.safeParse({
        type: "UPDATE",
        content: "hi",
        imageUrls: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`),
      }).success,
    ).toBe(false);
    expect(
      createPostSchema.safeParse({
        type: "UPDATE",
        content: "hi",
        authorId: "usr_other",
      }).success,
    ).toBe(false);
  });

  it("requires a meaningful update", () => {
    expect(updatePostSchema.safeParse({}).success).toBe(false);
    expect(updatePostSchema.safeParse({ content: "new" }).success).toBe(true);
    expect(
      updatePostSchema.safeParse({ imageUrls: ["https://example.com/a.jpg"] }).success,
    ).toBe(true);
  });

  it("validates social query and body schemas strictly", () => {
    expect(connectionListQuerySchema.parse({})).toEqual({ direction: "all" });
    expect(connectionListQuerySchema.safeParse({ direction: "sideways" }).success).toBe(false);
    expect(connectionListQuerySchema.safeParse({ userId: "usr_other" }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ type: "UPDATE" }).success).toBe(true);
    // Profiles list a member's posts by author; unknown keys are still rejected.
    expect(feedQuerySchema.safeParse({ authorId: "usr_other" }).success).toBe(true);
    expect(feedQuerySchema.safeParse({ ownerId: "usr_other" }).success).toBe(false);
    expect(createCommentSchema.safeParse({ content: "nice", postId: "post_1" }).success).toBe(
      false,
    );
  });
});

describe("discovery query validators", () => {
  it("coerces numeric query strings and applies defaults", () => {
    const parsed = businessesQuerySchema.parse({
      q: "kitchen",
      minAmountBdt: "10000",
      maxAmountBdt: "90000",
      minTrustScore: "70",
      maxTenureDays: "90",
    });
    expect(parsed).toMatchObject({
      q: "kitchen",
      minAmountBdt: 10_000,
      maxAmountBdt: 90_000,
      minTrustScore: 70,
      maxTenureDays: 90,
      sort: "newest",
    });
  });

  it("rejects inverted ranges, out-of-range scores and unsupported sorts", () => {
    expect(
      businessesQuerySchema.safeParse({ minAmountBdt: "50000", maxAmountBdt: "10000" }).success,
    ).toBe(false);
    expect(businessesQuerySchema.safeParse({ minTrustScore: "101" }).success).toBe(false);
    expect(businessesQuerySchema.safeParse({ sort: "amountAsc" }).success).toBe(false);
    expect(
      investorsQuerySchema.safeParse({ minLendBdt: "90000", maxLendBdt: "10000" }).success,
    ).toBe(false);
    expect(investorsQuerySchema.safeParse({ sort: "lendDesc" }).success).toBe(true);
    expect(investorsQuerySchema.safeParse({ role: "OWNER" }).success).toBe(false);
  });
});

describe("public response allow-lists", () => {
  const author = {
    name: "Nusrat",
    image: null,
    role: "OWNER" as const,
    verified: true,
    shopName: "Kitchen",
    slug: "kitchen",
    category: "Food",
  };

  it("rejects private fields in post, comment, connection and follow responses", () => {
    for (const schema of [postRecordSchema, commentRecordSchema, connectionRecordSchema]) {
      const base =
        schema === postRecordSchema
          ? {
              id: "post_1",
              type: "UPDATE",
              content: "hi",
              imageUrls: [],
              authorId: "usr_1",
              author,
              likeCount: 0,
              commentCount: 0,
              likedByMe: false,
              loanRequest: null,
              createdAt: "2026-11-23T10:00:00.000Z",
              updatedAt: "2026-11-23T10:00:00.000Z",
            }
          : schema === commentRecordSchema
            ? {
                id: "cmt_1",
                postId: "post_1",
                content: "hi",
                authorId: "usr_1",
                author,
                createdAt: "2026-11-23T10:00:00.000Z",
                updatedAt: "2026-11-23T10:00:00.000Z",
              }
            : {
                id: "con_1",
                userId: "usr_2",
                user: author,
                direction: "incoming",
                status: "PENDING",
                message: null,
                createdAt: "2026-11-23T10:00:00.000Z",
                updatedAt: "2026-11-23T10:00:00.000Z",
              };
      expect(schema.safeParse(base).success).toBe(true);
      expect(schema.safeParse({ ...base, email: "secret@example.com" }).success).toBe(false);
      expect(schema.safeParse({ ...base, phone: "+8801712345678" }).success).toBe(false);
    }
    expect(followResultSchema.safeParse({ userId: "usr_1", following: true }).success).toBe(true);
  });

  it("rejects private fields in discovery responses", () => {
    const business = {
      id: "usr_1",
      name: "Nusrat",
      image: null,
      role: "OWNER" as const,
      verified: true as const,
      shopName: "Kitchen",
      slug: "kitchen",
      category: "Food",
      district: "Dhaka",
      city: "Dhanmondi",
      logoUrl: null,
      trustScore: 80,
      description: null,
      loanRequest: null,
    };
    const investor = {
      id: "usr_2",
      name: "Rahim",
      image: null,
      role: "INVESTOR" as const,
      verified: true as const,
      bio: null,
      minLendBdt: 10_000,
      maxLendBdt: 100_000,
      preferredCategories: [],
      district: null,
      city: null,
      trustScore: 60,
    };
    expect(discoveryBusinessSchema.safeParse(business).success).toBe(true);
    expect(
      discoveryBusinessSchema.safeParse({ ...business, idDocumentUrl: "private" }).success,
    ).toBe(false);
    expect(discoveryInvestorSchema.safeParse(investor).success).toBe(true);
    expect(
      discoveryInvestorSchema.safeParse({ ...investor, email: "secret@example.com" }).success,
    ).toBe(false);
  });
});
