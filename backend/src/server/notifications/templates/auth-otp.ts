import { OTP_EXPIRY_SECONDS } from "@/server/auth/constants";
import { ValidationError } from "@/server/errors";

/** Matches the installed Better Auth emailOTP plugin's purpose union. */
export type AuthOtpPurpose =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

export interface AuthOtpEmail {
  subject: string;
  text: string;
  html: string;
}

interface PurposeCopy {
  subject: string;
  heading: string;
  intro: string;
}

const PURPOSE_COPY: Record<AuthOtpPurpose, PurposeCopy> = {
  "email-verification": {
    subject: "Verify your SME Connect email",
    heading: "Verify your email",
    intro: "Use the code below to verify your SME Connect email address.",
  },
  "forget-password": {
    subject: "Reset your SME Connect password",
    heading: "Reset your password",
    intro: "Use the code below to reset your SME Connect password.",
  },
  "sign-in": {
    subject: "Your SME Connect sign-in code",
    heading: "Your sign-in code",
    intro: "Use the code below to finish signing in to SME Connect.",
  },
  "change-email": {
    subject: "Confirm your SME Connect email change",
    heading: "Confirm your email change",
    intro: "Use the code below to confirm your new email address on SME Connect.",
  },
};

function formatExpiry(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} seconds`;
}

/** Derived from the shared auth constant; never a separate hardcoded value. */
export const OTP_EXPIRY_LABEL = formatExpiry(OTP_EXPIRY_SECONDS);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders both parts of an authentication OTP email for a known purpose. */
export function renderAuthOtpEmail(data: {
  otp: string;
  purpose: AuthOtpPurpose;
}): AuthOtpEmail {
  const copy: PurposeCopy | undefined = PURPOSE_COPY[data.purpose];
  if (!copy) {
    throw new ValidationError("Unsupported OTP purpose");
  }

  const safeOtp = escapeHtml(data.otp);
  const warning =
    "Never share this code with anyone. If you did not request it, you can ignore this email.";

  const text = [
    "SME Connect",
    "",
    copy.heading,
    "",
    copy.intro,
    "",
    `Your one-time code is: ${data.otp}`,
    `It expires in ${OTP_EXPIRY_LABEL}.`,
    "",
    warning,
    "",
    "- SME Connect",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f766e;">SME Connect</p>
          <h1 style="margin:0 0 16px;font-size:24px;">${copy.heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${copy.intro}</p>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#4b5563;">Your one-time code</p>
          <div style="padding:14px 18px;background:#f3f4f6;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:0.18em;text-align:center;">${safeOtp}</div>
          <p style="margin:16px 0 0;font-size:14px;color:#4b5563;">This code expires in ${OTP_EXPIRY_LABEL}.</p>
          <p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#4b5563;">${warning}</p>
          <p style="margin:28px 0 0;font-size:13px;color:#6b7280;">- SME Connect</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: copy.subject, text, html };
}
