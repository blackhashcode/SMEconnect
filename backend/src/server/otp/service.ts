import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import {
  OTP_EXPIRY_SECONDS,
  PHONE_OTP_IDENTIFIER_PREFIX,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
} from "@/server/auth/constants";
import { prisma } from "@/server/db";
import { AppError, ForbiddenError, NotFoundError, RateLimitError, ValidationError } from "@/server/errors";
import { sendOtp, type OtpDeliveryChannel, type OtpDeliveryProvider } from "@/server/otp/delivery";

export interface PhoneOtpDeps {
  db?: typeof prisma;
  now?: () => Date;
  otpSender?: (request: Parameters<typeof sendOtp>[0]) => Promise<OtpDeliveryChannel>;
  deliveryProvider?: OtpDeliveryProvider;
}

export interface RequestPhoneOtpInput {
  userId: string;
  phone: string;
}

export interface VerifyPhoneOtpInput {
  userId: string;
  phone: string;
  otp: string;
}

/** Normalizes local Bangladeshi numbers to a single E.164-like identifier. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return trimmed;

  if (digits.startsWith("880")) return `+${digits}`;
  if (digits.startsWith("0")) return `+88${digits}`;
  return `+${digits}`;
}

function identifierFor(phone: string): string {
  return `${PHONE_OTP_IDENTIFIER_PREFIX}:${phone}`;
}

function hmacSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new AppError("OTP_CONFIG_ERROR", "OTP secret is not configured", 500);
  }
  return secret;
}

/** Hashes never contain the OTP in plaintext; the attempt count is stored beside it. */
function hashOtp(phone: string, otp: string): string {
  return createHmac("sha256", hmacSecret())
    .update(`${PHONE_OTP_IDENTIFIER_PREFIX}:${phone}:${otp}`)
    .digest("hex");
}

function encodeValue(hash: string, attempts: number): string {
  return `${hash}:${attempts}`;
}

function decodeValue(value: string): { hash: string; attempts: number } | null {
  const match = /^([a-f0-9]{64}):(\d+)$/.exec(value);
  if (!match) return null;
  return { hash: match[1], attempts: Number(match[2]) };
}

function hashesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestPhoneOtp(
  { userId, phone }: RequestPhoneOtpInput,
  deps: PhoneOtpDeps = {},
): Promise<{ phone: string; expiresInSeconds: number; sentVia: OtpDeliveryChannel }> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const normalized = normalizePhone(phone);
  const identifier = identifierFor(normalized);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true },
  });
  if (!user) throw new NotFoundError("Account not found");
  if (user.phone && user.phone !== normalized) {
    throw new ForbiddenError("A different phone number is already linked to this account");
  }

  const existing = await db.verification.findFirst({ where: { identifier } });
  if (existing) {
    const lastSentAt = existing.updatedAt ?? existing.createdAt ?? now;
    const retryAfterMs =
      PHONE_OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now.getTime() - lastSentAt.getTime());

    if (existing.expiresAt > now && retryAfterMs > 0) {
      throw new RateLimitError("Please wait before requesting another OTP", {
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      });
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
  const value = encodeValue(hashOtp(normalized, otp), 0);

  await db.$transaction(async (tx) => {
    await tx.verification.deleteMany({ where: { identifier } });
    await tx.verification.create({
      data: { identifier, value, expiresAt },
    });
  });

  try {
    const send = deps.otpSender ?? ((request: Parameters<typeof sendOtp>[0]) =>
      sendOtp(request, deps.deliveryProvider ? { provider: deps.deliveryProvider } : {}));
    const sentVia = await send({
      to: normalized,
      otp,
      purpose: "phone-verification",
      expiresInSeconds: OTP_EXPIRY_SECONDS,
      email: user.email,
    });

    return { phone: normalized, expiresInSeconds: OTP_EXPIRY_SECONDS, sentVia };
  } catch (error) {
    // Do not leave an undeliverable challenge blocking the next request.
    await db.verification.deleteMany({ where: { identifier } });
    throw error;
  }
}

export async function verifyPhoneOtp(
  { userId, phone, otp }: VerifyPhoneOtpInput,
  deps: PhoneOtpDeps = {},
): Promise<{ phone: string; phoneVerified: true }> {
  const db = deps.db ?? prisma;
  const now = (deps.now ?? (() => new Date()))();
  const normalized = normalizePhone(phone);
  const identifier = identifierFor(normalized);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  if (!user) throw new NotFoundError("Account not found");
  if (user.phone && user.phone !== normalized) {
    throw new ForbiddenError("A different phone number is already linked to this account");
  }

  const record = await db.verification.findFirst({ where: { identifier } });
  if (!record) throw new ValidationError("Invalid or expired OTP");

  if (record.expiresAt <= now) {
    await db.verification.deleteMany({ where: { identifier } });
    throw new AppError("OTP_EXPIRED", "OTP expired", 400);
  }

  const stored = decodeValue(record.value);
  if (!stored || stored.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new RateLimitError("Too many OTP attempts", {
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    });
  }

  if (!hashesMatch(stored.hash, hashOtp(normalized, otp))) {
    const attempts = stored.attempts + 1;
    await db.verification.update({
      where: { id: record.id },
      data: { value: encodeValue(stored.hash, attempts) },
    });

    // The third incorrect attempt invalidates the code. The counter stays at
    // the maximum so later attempts hit the guard above until a new code is
    // requested (which replaces this challenge).
    if (attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      throw new RateLimitError("Too many OTP attempts; request a new code", {
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      });
    }

    throw new ValidationError("Invalid OTP", {
      remainingAttempts: Math.max(0, PHONE_OTP_MAX_ATTEMPTS - attempts),
    });
  }

  await db.$transaction(async (tx) => {
    await tx.verification.deleteMany({ where: { identifier } });
    await tx.user.update({
      where: { id: userId },
      data: { phone: normalized, phoneVerified: true },
    });
  });

  return { phone: normalized, phoneVerified: true };
}

/** Exported so duplicate phone numbers surface as a clean 409 at the route level. */
export function isUniquePhoneConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
