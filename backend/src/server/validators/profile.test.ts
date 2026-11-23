import { describe, expect, it } from "vitest";
import {
  createProductImageSchema,
  profileImageUrlSchema,
  updateMeSchema,
} from "@/server/validators/profile";

const PUBLIC_URL =
  "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg";
const PRIVATE_URL =
  "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf";

describe("profile image URLs", () => {
  it("accepts external HTTPS URLs and internal public file URLs", () => {
    expect(profileImageUrlSchema.safeParse("https://example.com/logo.jpg").success).toBe(true);
    expect(profileImageUrlSchema.safeParse(PUBLIC_URL).success).toBe(true);
  });

  it("rejects private verification files and arbitrary relative paths", () => {
    expect(profileImageUrlSchema.safeParse(PRIVATE_URL).success).toBe(false);
    expect(profileImageUrlSchema.safeParse("/etc/passwd").success).toBe(false);
  });
});

describe("updateMeSchema", () => {
  it("rejects client-supplied identity, role, status and verification fields", () => {
    for (const field of [
      "userId",
      "role",
      "status",
      "verificationStatus",
      "trustScore",
      "ownerId",
    ]) {
      expect(updateMeSchema.safeParse({ name: "Valid Name", [field]: "OWNER" }).success).toBe(
        false,
      );
    }
  });

  it("accepts account fields with an owner profile using a public image", () => {
    const result = updateMeSchema.safeParse({
      name: "Nusrat Akter",
      image: PUBLIC_URL,
      profile: {
        shopName: "Nusrat's Home Kitchen",
        slug: "nusrat-home-kitchen",
        category: "Food",
        district: "Dhaka",
        city: "Dhanmondi",
        logoUrl: PUBLIC_URL,
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts an investor profile and normalizes preferred rates", () => {
    const result = updateMeSchema.safeParse({
      profile: {
        minLendBdt: 20_000,
        maxLendBdt: 100_000,
        preferredRatePctMin: "10",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const profile = result.data.profile as { preferredRatePctMin?: string };
      expect(profile.preferredRatePctMin).toBe("10.00");
    }
  });

  it("rejects mixed owner and investor profile fields", () => {
    expect(
      updateMeSchema.safeParse({
        profile: { shopName: "Shop", slug: "my-shop", minLendBdt: 1000 },
      }).success,
    ).toBe(false);
  });

  it("rejects private files in profile images", () => {
    expect(
      updateMeSchema.safeParse({ image: PRIVATE_URL }).success,
    ).toBe(false);
    expect(
      updateMeSchema.safeParse({
        profile: {
          shopName: "Shop",
          slug: "my-shop",
          category: "Food",
          district: "Dhaka",
          city: "Dhanmondi",
          coverUrl: PRIVATE_URL,
        },
      }).success,
    ).toBe(false);
  });
});

describe("createProductImageSchema", () => {
  it("accepts a public upload URL and auto position", () => {
    expect(
      createProductImageSchema.safeParse({ url: PUBLIC_URL, caption: "Dish" }).success,
    ).toBe(true);
  });

  it("rejects private files", () => {
    expect(createProductImageSchema.safeParse({ url: PRIVATE_URL }).success).toBe(false);
  });
});
