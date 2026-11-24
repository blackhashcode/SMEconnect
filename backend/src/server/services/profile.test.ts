import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import {
  addProductImage,
  deleteProductImage,
  getMe,
  getPublicProfile,
  updateMe,
  updateProductImage,
} from "@/server/services/profile";

type Row = Record<string, unknown>;

/** Minimal shape of the Prisma delegate methods used by the profile service. */
interface FakeDb {
  user: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    update: (args: { where: Row; data: Row }) => Promise<Row>;
  };
  businessProfile: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    upsert: (args: { where: Row; create: Row; update: Row }) => Promise<Row>;
    create: (args: { data: Row }) => Promise<Row>;
    update: (args: { where: Row; data: Row }) => Promise<Row>;
  };
  investorProfile: {
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    upsert: (args: { where: Row; create: Row; update: Row }) => Promise<Row>;
    create: (args: { data: Row }) => Promise<Row>;
    update: (args: { where: Row; data: Row }) => Promise<Row>;
  };
  userVerification: {
    findFirst: (args: { where: Row }) => Promise<Row | null>;
  };
  notification: { count: () => Promise<number> };
  message: { count: () => Promise<number> };
  productImage: {
    findFirst: (args: { where: Row }) => Promise<Row | null>;
    findUnique: (args: { where: Row }) => Promise<Row | null>;
    create: (args: { data: Row }) => Promise<Row>;
    update: (args: { where: Row; data: Row }) => Promise<Row>;
    delete: (args: { where: Row }) => Promise<Row>;
  };
  $transaction: (callback: (tx: FakeDb) => Promise<unknown>) => Promise<unknown>;
}

const NOW = new Date("2026-11-23T18:00:00.000Z");
const PUBLIC_URL =
  "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg";
const PRIVATE_URL =
  "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };
const otherOwner = { id: "usr_other", role: "OWNER" as const };

function uniqueError(field: string) {
  const error = new Error("Unique constraint failed") as Error & {
    code: string;
    meta: { target: string[] };
  };
  error.code = "P2002";
  error.meta = { target: [field] };
  return error;
}

function createFakeDb() {
  const users = new Map<string, Row>();
  const businesses = new Map<string, Row>();
  const investors = new Map<string, Row>();
  const verifications = new Map<string, Row>();
  const images: Row[] = [];
  let imageSeq = 0;

  function businessWithImages(row: Row): Row {
    return {
      ...row,
      productImages: images
        .filter((image) => image.businessProfileId === row.id)
        .sort((a, b) => Number(a.position) - Number(b.position)),
    };
  }

  const db: FakeDb = {
    user: {
      findUnique: async ({ where }: { where: Row }) => users.get(where.id as string) ?? null,
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = users.get(where.id as string);
        if (!row) throw new Error("User missing");
        Object.assign(row, data);
        return row;
      },
    },
    businessProfile: {
      findUnique: async ({ where }: { where: Row }) => {
        const row = businesses.get(where.ownerId as string);
        return row ? businessWithImages(row) : null;
      },
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const key = where.ownerId as string;
        const existing = businesses.get(key);
        const row = existing
          ? Object.assign(existing, update)
          : { id: `bp_${key}`, createdAt: NOW, updatedAt: NOW, ...create };
        businesses.set(key, row);
        return businessWithImages(row);
      },
      create: async ({ data }: { data: Row }) => db.businessProfile.upsert({ where: { ownerId: data.ownerId }, create: data, update: {} }),
      update: async ({ where, data }: { where: Row; data: Row }) => db.businessProfile.upsert({ where, create: data, update: data }),
    },
    investorProfile: {
      findUnique: async ({ where }: { where: Row }) =>
        investors.get(where.userId as string) ?? null,
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const key = where.userId as string;
        const existing = investors.get(key);
        const row = existing
          ? Object.assign(existing, update)
          : { id: `ip_${key}`, createdAt: NOW, updatedAt: NOW, ...create };
        investors.set(key, row);
        return row;
      },
      create: async ({ data }: { data: Row }) => db.investorProfile.upsert({ where: { userId: data.userId }, create: data, update: {} }),
      update: async ({ where, data }: { where: Row; data: Row }) => db.investorProfile.upsert({ where, create: data, update: data }),
    },
    userVerification: {
      findFirst: async ({ where }: { where: Row }) =>
        verifications.get(where.userId as string) ?? null,
    },
    notification: { count: async () => 2 },
    message: { count: async () => 0 },
    productImage: {
      findFirst: async ({ where }: { where: Row }) =>
        images
          .filter((image) => image.businessProfileId === where.businessProfileId)
          .sort((a, b) => Number(b.position) - Number(a.position))[0] ?? null,
      findUnique: async ({ where }: { where: Row }) => {
        const image = images.find((item) => item.id === where.id);
        if (!image) return null;
        const profile = [...businesses.values()].find(
          (item) => item.id === image.businessProfileId,
        );
        return { ...image, businessProfile: { ownerId: profile?.ownerId ?? null } };
      },
      create: async ({ data }: { data: Row }) => {
        const duplicate = images.some(
          (image) =>
            image.businessProfileId === data.businessProfileId &&
            image.position === data.position,
        );
        if (duplicate) throw uniqueError("position");
        const row: Row = {
          id: `img_${++imageSeq}`,
          businessProfileId: data.businessProfileId,
          url: data.url,
          caption: data.caption ?? null,
          position: data.position,
        };
        images.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = images.find((image) => image.id === where.id);
        if (!row) throw new Error("Image missing");
        if (
          data.position !== undefined &&
          images.some(
            (image) =>
              image.id !== row.id &&
              image.businessProfileId === row.businessProfileId &&
              image.position === data.position,
          )
        ) {
          throw uniqueError("position");
        }
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: { where: Row }) => {
        const index = images.findIndex((image) => image.id === where.id);
        if (index >= 0) images.splice(index, 1);
        return {};
      },
    },
    $transaction: async (callback: (tx: typeof db) => Promise<unknown>) => callback(db),
  };

  return { db, users, businesses, investors, verifications, images };
}

function seedUser(state: ReturnType<typeof createFakeDb>, actor: { id: string; role: string }, overrides: Row = {}) {
  state.users.set(actor.id, {
    id: actor.id,
    name: "Test User",
    email: `${actor.id}@example.com`,
    emailVerified: true,
    role: actor.role,
    status: "ACTIVE",
    phone: "+8801712345678",
    phoneVerified: true,
    image: null,
    ...overrides,
  });
}

function seedBusiness(state: ReturnType<typeof createFakeDb>, ownerId: string, overrides: Row = {}) {
  const row: Row = {
    id: `bp_${ownerId}`,
    ownerId,
    shopName: "Nusrat's Home Kitchen",
    slug: "nusrat-home-kitchen",
    category: "Food",
    description: null,
    district: "Dhaka",
    city: "Dhanmondi",
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    websiteUrl: null,
    runningSince: null,
    monthlyOrdersRange: null,
    monthlySalesMinBdt: 20_000,
    monthlySalesMaxBdt: 50_000,
    growthStory: null,
    logoUrl: null,
    coverUrl: null,
    trustScore: 42,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  state.businesses.set(ownerId, row);
  return row;
}

function seedInvestor(state: ReturnType<typeof createFakeDb>, userId: string, overrides: Row = {}) {
  const row: Row = {
    id: `ip_${userId}`,
    userId,
    bio: "Investing in local food businesses",
    minLendBdt: 20_000,
    maxLendBdt: 100_000,
    preferredCategories: ["Food"],
    preferredTenureDays: 90,
    preferredRatePctMin: "10.00",
    preferredRatePctMax: "16.00",
    district: "Dhaka",
    city: null,
    trustScore: 55,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
  state.investors.set(userId, row);
  return row;
}

function seedVerification(state: ReturnType<typeof createFakeDb>, userId: string, status: string) {
  state.verifications.set(userId, { userId, type: "OWNER", status });
}

function deps(state: ReturnType<typeof createFakeDb>) {
  return { db: state.db as never };
}

const fullBusinessInput = {
  shopName: "Nusrat's Home Kitchen",
  slug: "nusrat-home-kitchen",
  category: "Food",
  district: "Dhaka",
  city: "Dhanmondi",
};

const fullInvestorInput = { minLendBdt: 20_000, maxLendBdt: 100_000 };

describe("getMe", () => {
  it("returns the owner account, business profile and verification state", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id);
    seedVerification(state, owner.id, "APPROVED");
    state.images.push({
      id: "img_1",
      businessProfileId: `bp_${owner.id}`,
      url: PUBLIC_URL,
      caption: "Dish",
      position: 0,
    });

    const result = await getMe(owner, deps(state));

    expect(result.user).toMatchObject({
      id: owner.id,
      role: "OWNER",
      email: `${owner.id}@example.com`,
      phone: "+8801712345678",
    });
    expect(result.profile).toMatchObject({ shopName: "Nusrat's Home Kitchen", trustScore: 42 });
    expect(result.profile).toHaveProperty("productImages");
    expect(result.verification).toEqual({ type: "OWNER", status: "APPROVED" });
    expect(result.unread).toEqual({ notifications: 2, messages: 0 });
  });

  it("returns the investor profile for an INVESTOR", async () => {
    const state = createFakeDb();
    seedUser(state, investor);
    seedInvestor(state, investor.id);

    const result = await getMe(investor, deps(state));

    expect(result.profile).toMatchObject({ minLendBdt: 20_000, maxLendBdt: 100_000 });
    expect(result.verification).toBeNull();
  });

  it("never gives an admin an owner or investor profile", async () => {
    const state = createFakeDb();
    seedUser(state, admin);
    seedBusiness(state, admin.id);

    const result = await getMe(admin, deps(state));

    expect(result.profile).toBeNull();
    expect(result.verification).toBeNull();
  });

  it("throws 404 when the account is missing", async () => {
    const state = createFakeDb();
    await expect(getMe(owner, deps(state))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateMe", () => {
  it("creates an owner profile using the session id, not a client id", async () => {
    const state = createFakeDb();
    seedUser(state, owner);

    const result = await updateMe(owner, { profile: fullBusinessInput }, deps(state));

    expect(state.businesses.get(owner.id)).toMatchObject({
      ownerId: owner.id,
      shopName: "Nusrat's Home Kitchen",
      trustScore: 0,
    });
    expect(result.profile).toMatchObject({ slug: "nusrat-home-kitchen" });
  });

  it("rejects a partial payload when no profile exists yet", async () => {
    const state = createFakeDb();
    seedUser(state, owner);

    await expect(
      updateMe(owner, { profile: { shopName: "Only a name" } }, deps(state)),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects investor fields sent by an owner", async () => {
    const state = createFakeDb();
    seedUser(state, owner);

    await expect(
      updateMe(owner, { profile: fullInvestorInput }, deps(state)),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("rejects an admin attempting to modify a profile", async () => {
    const state = createFakeDb();
    seedUser(state, admin);

    await expect(
      updateMe(admin, { profile: fullBusinessInput }, deps(state)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("updates existing values without overwriting the server-owned trust score", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id, { trustScore: 78, growthStory: "Started in 2024" });

    const result = await updateMe(
      owner,
      { name: "New Name", profile: { city: "Mirpur" } },
      deps(state),
    );

    expect(state.users.get(owner.id)?.name).toBe("New Name");
    expect(state.businesses.get(owner.id)).toMatchObject({
      trustScore: 78,
      growthStory: "Started in 2024",
      city: "Mirpur",
    });
    expect(result.profile).toMatchObject({ city: "Mirpur", trustScore: 78 });
  });

  it("re-checks range invariants against stored values after a partial update", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id, { monthlySalesMinBdt: 60_000, monthlySalesMaxBdt: 90_000 });

    await expect(
      updateMe(owner, { profile: { monthlySalesMinBdt: 120_000 } }, deps(state)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("maps a duplicate slug to a conflict", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id);
    state.businesses.get(owner.id)!.slug = "taken-slug";
    const originalUpdate = state.db.businessProfile.update;
    state.db.businessProfile.update = async (args: { where: Row; data: Row }) => {
      if ((args.data as Row).slug === "taken-slug") throw uniqueError("slug");
      return originalUpdate(args);
    };

    await expect(
      updateMe(owner, { profile: { slug: "taken-slug" } }, deps(state)),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Slug is already in use" });
  });

  it("creates and updates an investor profile with normalized rates", async () => {
    const state = createFakeDb();
    seedUser(state, investor);

    const created = await updateMe(
      investor,
      {
        profile: {
          ...fullInvestorInput,
          preferredRatePctMin: "10",
          preferredRatePctMax: "16.5",
        },
      },
      deps(state),
    );

    expect(state.investors.get(investor.id)).toMatchObject({
      userId: investor.id,
      trustScore: 0,
      preferredRatePctMin: "10.00",
      preferredRatePctMax: "16.50",
    });
    expect(created.profile).toMatchObject({ preferredRatePctMax: "16.50" });

    await expect(
      updateMe(
        investor,
        { profile: { minLendBdt: 500_000 } },
        deps(state),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("getPublicProfile", () => {
  it("returns only public owner fields and a verified badge", async () => {
    const state = createFakeDb();
    seedUser(state, owner, { name: "Nusrat Akter", image: PUBLIC_URL, email: "secret@example.com", phone: "+8801712345678" });
    seedBusiness(state, owner.id, { logoUrl: PUBLIC_URL });
    seedVerification(state, owner.id, "APPROVED");
    state.images.push({
      id: "img_1",
      businessProfileId: `bp_${owner.id}`,
      url: PUBLIC_URL,
      caption: "Dish",
      position: 0,
    });

    const result = (await getPublicProfile(owner.id, deps(state))) as Row;
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({ name: "Nusrat Akter", role: "OWNER", verified: true });
    for (const forbidden of [
      "email",
      "phone",
      "userId",
      "ownerId",
      "idDocumentUrl",
      "reviewNote",
      "reviewerId",
      "secret@example.com",
      "+8801712345678",
      owner.id,
      "img_1",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(result.profile).toHaveProperty("productImages");
    expect(JSON.stringify((result.profile as Row).productImages)).not.toContain("img_1");
  });

  it("returns only public investor fields", async () => {
    const state = createFakeDb();
    seedUser(state, investor);
    seedInvestor(state, investor.id);
    state.verifications.set(investor.id, { userId: investor.id, type: "INVESTOR", status: "PENDING" });

    const result = (await getPublicProfile(investor.id, deps(state))) as Row;
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({ role: "INVESTOR", verified: false });
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain(investor.id);
  });

  it("returns 404 for admins, suspended users, missing users and missing profiles", async () => {
    const adminState = createFakeDb();
    seedUser(adminState, admin);
    await expect(getPublicProfile(admin.id, deps(adminState))).rejects.toBeInstanceOf(NotFoundError);

    const suspendedState = createFakeDb();
    seedUser(suspendedState, owner, { status: "SUSPENDED" });
    seedBusiness(suspendedState, owner.id);
    await expect(getPublicProfile(owner.id, deps(suspendedState))).rejects.toBeInstanceOf(NotFoundError);

    const noUserState = createFakeDb();
    await expect(getPublicProfile(owner.id, deps(noUserState))).rejects.toBeInstanceOf(NotFoundError);

    const noProfileState = createFakeDb();
    seedUser(noProfileState, owner);
    await expect(getPublicProfile(owner.id, deps(noProfileState))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("product images", () => {
  it("appends images to the owner's own profile", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id);

    const first = await addProductImage(
      owner,
      { url: PUBLIC_URL, caption: "First" },
      deps(state),
    );
    const second = await addProductImage(
      owner,
      { url: PUBLIC_URL, caption: "Second" },
      deps(state),
    );

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
    expect(state.images).toHaveLength(2);
  });

  it("rejects non-owners and conflicting positions", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedBusiness(state, owner.id);

    await expect(
      addProductImage(investor, { url: PUBLIC_URL }, deps(state)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      addProductImage(owner, { url: PRIVATE_URL }, deps(state)),
    ).rejects.toBeInstanceOf(ZodError);

    await addProductImage(owner, { url: PUBLIC_URL, position: 0 }, deps(state));
    await expect(
      addProductImage(owner, { url: PUBLIC_URL, position: 0 }, deps(state)),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires ownership for edits and deletes", async () => {
    const state = createFakeDb();
    seedUser(state, owner);
    seedUser(state, otherOwner);
    seedBusiness(state, owner.id);
    await addProductImage(owner, { url: PUBLIC_URL }, deps(state));

    await expect(
      updateProductImage(otherOwner, "img_1", { caption: "Stolen" }, deps(state)),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      deleteProductImage(otherOwner, "img_1", deps(state)),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      getPublicProfile("missing", deps(state)),
    ).rejects.toBeInstanceOf(NotFoundError);

    const edited = await updateProductImage(owner, "img_1", { caption: "Mine" }, deps(state));
    expect(edited.caption).toBe("Mine");

    const deleted = await deleteProductImage(owner, "img_1", deps(state));
    expect(deleted).toEqual({ id: "img_1", deleted: true });
    expect(state.images).toHaveLength(0);
  });
});
