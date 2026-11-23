import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import { AppError, RateLimitError, ValidationError } from "@/server/errors";
import { normalizePhone, requestPhoneOtp, verifyPhoneOtp } from "@/server/otp/service";

interface OtpRecord {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function createFakeDb(now: () => Date, initialPhone: string | null = null) {
  let records: OtpRecord[] = [];
  let userPhone = initialPhone;
  let sequence = 0;

  const db = {
    verification: {
      findFirst: async ({ where }: { where: { identifier: string } }) =>
        records.find((record) => record.identifier === where.identifier) ?? null,
      deleteMany: async ({ where }: { where: { identifier: string } }) => {
        const before = records.length;
        records = records.filter((record) => record.identifier !== where.identifier);
        return { count: before - records.length };
      },
      create: async ({
        data,
      }: {
        data: { identifier: string; value: string; expiresAt: Date };
      }) => {
        const record: OtpRecord = {
          id: `otp_${++sequence}`,
          createdAt: now(),
          updatedAt: now(),
          ...data,
        };
        records.push(record);
        return record;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { value: string };
      }) => {
        const record = records.find((item) => item.id === where.id);
        if (!record) throw new Error("OTP record missing");
        record.value = data.value;
        record.updatedAt = now();
        return record;
      },
    },
    user: {
      findUnique: async () => ({
        id: "usr_1",
        phone: userPhone,
        email: "owner@example.com",
      }),
      update: async ({ data }: { data: { phone?: string | null } }) => {
        if (data.phone !== undefined) userPhone = data.phone;
        return { id: "usr_1", phone: userPhone };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };

  return {
    db,
    records: () => records,
    phone: () => userPhone,
  };
}

const start = new Date("2026-11-23T18:00:00.000Z");

function depsFor(fake: ReturnType<typeof createFakeDb>, now: () => Date, otpSender: (request: { otp: string }) => Promise<"email">) {
  return {
    db: fake.db as never,
    now,
    otpSender: otpSender as never,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("phone normalization", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["0171 234-5678", "+8801712345678"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("phone OTP service", () => {
  it("stores only a hashed code with an attempt counter", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-otp-hmac");
    const now = () => start;
    const fake = createFakeDb(now);
    const sent: string[] = [];
    const deps = depsFor(fake, now, async (request) => {
      sent.push(request.otp);
      return "email";
    });

    const result = await requestPhoneOtp(
      { userId: "usr_1", phone: "01712345678" },
      deps,
    );

    expect(result).toEqual({
      phone: "+8801712345678",
      expiresInSeconds: 300,
      sentVia: "email",
    });
    expect(sent[0]).toMatch(/^\d{6}$/);
    expect(fake.records()).toHaveLength(1);
    expect(fake.records()[0].value).toMatch(/^[a-f0-9]{64}:0$/);
    expect(fake.records()[0].value).not.toContain(sent[0]);
    expect(fake.records()[0].expiresAt).toEqual(new Date(start.getTime() + 300_000));
  });

  it("rate-limits resends inside the cooldown", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-otp-hmac");
    const now = () => start;
    const fake = createFakeDb(now);
    const deps = depsFor(fake, now, async () => "email");

    await requestPhoneOtp({ userId: "usr_1", phone: "01712345678" }, deps);
    await expect(
      requestPhoneOtp({ userId: "usr_1", phone: "01712345678" }, deps),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(fake.records()).toHaveLength(1);
  });

  it("rejects an expired code", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-otp-hmac");
    let current = start;
    const now = () => current;
    const fake = createFakeDb(now);
    let sentOtp = "";
    const deps = depsFor(fake, now, async (request) => {
      sentOtp = request.otp;
      return "email";
    });

    await requestPhoneOtp({ userId: "usr_1", phone: "01712345678" }, deps);
    current = new Date(start.getTime() + 301_000);

    await expect(
      verifyPhoneOtp(
        { userId: "usr_1", phone: "01712345678", otp: sentOtp },
        { db: fake.db as never, now },
      ),
    ).rejects.toMatchObject({ code: "OTP_EXPIRED", status: 400 });
    expect(fake.records()).toHaveLength(0);
  });

  it("limits failed attempts to three", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-otp-hmac");
    const now = () => start;
    const fake = createFakeDb(now);
    const deps = depsFor(fake, now, async () => "email");

    await requestPhoneOtp({ userId: "usr_1", phone: "01712345678" }, deps);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        verifyPhoneOtp(
          { userId: "usr_1", phone: "01712345678", otp: "000000" },
          { db: fake.db as never, now },
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    }

    await expect(
      verifyPhoneOtp(
        { userId: "usr_1", phone: "01712345678", otp: "000000" },
        { db: fake.db as never, now },
      ),
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(fake.records()[0].value).toMatch(/:3$/);
  });

  it("consumes a valid code and links the phone", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-otp-hmac");
    const now = () => start;
    const fake = createFakeDb(now);
    let sentOtp = "";
    const deps = depsFor(fake, now, async (request) => {
      sentOtp = request.otp;
      return "email";
    });

    await requestPhoneOtp({ userId: "usr_1", phone: "01712345678" }, deps);
    const result = await verifyPhoneOtp(
      { userId: "usr_1", phone: "01712345678", otp: sentOtp },
      { db: fake.db as never, now },
    );

    expect(result).toEqual({ phone: "+8801712345678", phoneVerified: true });
    expect(fake.phone()).toBe("+8801712345678");
    expect(fake.records()).toHaveLength(0);
  });

  it("fails closed when the OTP secret is missing", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const now = () => start;
    const fake = createFakeDb(now);

    await expect(
      requestPhoneOtp(
        { userId: "usr_1", phone: "01712345678" },
        { db: fake.db as never, now, otpSender: (async () => "email") as never },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
