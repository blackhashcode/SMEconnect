import { describe, expect, it } from "vitest";
import { OTP_EXPIRY_SECONDS } from "@/server/auth/constants";
import { ValidationError } from "@/server/errors";
import {
  escapeHtml,
  OTP_EXPIRY_LABEL,
  renderAuthOtpEmail,
  type AuthOtpPurpose,
} from "@/server/notifications/templates/auth-otp";

const purposeCases: Array<[AuthOtpPurpose, string, string]> = [
  [
    "email-verification",
    "Verify your SME Connect email",
    "Verify your email",
  ],
  ["forget-password", "Reset your SME Connect password", "Reset your password"],
  ["sign-in", "Your SME Connect sign-in code", "Your sign-in code"],
  [
    "change-email",
    "Confirm your SME Connect email change",
    "Confirm your email change",
  ],
];

describe("renderAuthOtpEmail", () => {
  it.each(purposeCases)(
    "renders the %s purpose with a clear subject and both formats",
    (purpose, subject, heading) => {
      const result = renderAuthOtpEmail({ otp: "123456", purpose });

      expect(result.subject).toBe(subject);
      expect(result.text).toContain(heading);
      expect(result.html).toContain(heading);
      expect(result.text).toContain("123456");
      expect(result.html).toContain("123456");
      expect(result.text).toContain(`expires in ${OTP_EXPIRY_LABEL}`);
      expect(result.html).toContain(`expires in ${OTP_EXPIRY_LABEL}`);
      expect(result.text.toLowerCase()).toContain("never share this code");
      expect(result.html.toLowerCase()).toContain("never share this code");
    },
  );

  it("derives the displayed expiry from the shared auth constant", () => {
    expect(OTP_EXPIRY_LABEL).toBe(`${OTP_EXPIRY_SECONDS / 60} minutes`);
  });

  it("escapes dynamic values in HTML", () => {
    const otp = `<b>&"'</b>`;
    const result = renderAuthOtpEmail({
      otp,
      purpose: "email-verification",
    });

    expect(result.html).toContain(escapeHtml(otp));
    expect(result.html).not.toContain(otp);
    expect(result.html).not.toContain("<b>");
  });

  it("leaves the plain-text OTP readable", () => {
    const otp = `<b>&"'</b>`;
    const result = renderAuthOtpEmail({ otp, purpose: "forget-password" });

    expect(result.text).toContain(otp);
  });

  it("rejects an unsupported purpose", () => {
    expect(() =>
      renderAuthOtpEmail({
        otp: "123456",
        purpose: "unknown" as AuthOtpPurpose,
      }),
    ).toThrow(ValidationError);
  });
});

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
