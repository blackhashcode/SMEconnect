import {
  sendEmail,
  type EmailMessage,
} from "@/server/notifications/email";
import {
  renderAuthOtpEmail,
  type AuthOtpPurpose,
} from "@/server/notifications/templates/auth-otp";

export interface AuthOtpEmailInput {
  email: string;
  otp: string;
  type: AuthOtpPurpose;
}

type EmailSender = (message: EmailMessage) => Promise<void>;

export interface AuthOtpEmailDependencies {
  /** Injected in tests to verify purpose routing without SMTP. */
  sendEmail?: EmailSender;
}

/** Routes Better Auth OTP purposes to the matching email template. */
export async function sendAuthOtpEmail(
  input: AuthOtpEmailInput,
  deps: AuthOtpEmailDependencies = {},
): Promise<void> {
  const rendered = renderAuthOtpEmail({
    otp: input.otp,
    purpose: input.type,
  });

  const deliver = deps.sendEmail ?? sendEmail;
  await deliver({
    to: input.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
}
