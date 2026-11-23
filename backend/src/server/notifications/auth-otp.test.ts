import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/errors";
import { sendAuthOtpEmail } from "@/server/notifications/auth-otp";
import type { EmailMessage } from "@/server/notifications/email";
import type { AuthOtpPurpose } from "@/server/notifications/templates/auth-otp";

const purposeCases: Array<[AuthOtpPurpose, string]> = [
  ["email-verification", "Verify your SME Connect email"],
  ["forget-password", "Reset your SME Connect password"],
  ["sign-in", "Your SME Connect sign-in code"],
  ["change-email", "Confirm your SME Connect email change"],
];

describe("sendAuthOtpEmail", () => {
  it.each(purposeCases)(
    "routes the %s purpose to its own template and recipient",
    async (type, expectedSubject) => {
      const sent: EmailMessage[] = [];

      await sendAuthOtpEmail(
        { email: "owner@example.com", otp: "654321", type },
        {
          sendEmail: async (message: EmailMessage) => {
            sent.push(message);
          },
        },
      );

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        to: "owner@example.com",
        subject: expectedSubject,
      });
      expect(sent[0]?.text).toContain("654321");
      expect(sent[0]?.html).toContain("654321");
    },
  );

  it("does not send when the OTP purpose is unsupported", async () => {
    const sent: EmailMessage[] = [];

    await expect(
      sendAuthOtpEmail(
        {
          email: "owner@example.com",
          otp: "654321",
          type: "unknown" as AuthOtpPurpose,
        },
        {
          sendEmail: async (message: EmailMessage) => {
            sent.push(message);
          },
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(sent).toHaveLength(0);
  });
});
