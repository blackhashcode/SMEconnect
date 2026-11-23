import { EmailDeliveryError } from "@/server/errors";
import {
  getDefaultEmailDeliveryContext,
  type EmailDeliveryContext,
} from "@/server/notifications/smtp";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailDependencies {
  /** Injected in tests or by callers that manage their own transport. */
  deliveryContext?: EmailDeliveryContext;
}

/**
 * Sends a fully rendered email. Transport errors are replaced with a safe
 * domain error so credentials, SMTP replies and message bodies never leak.
 */
export async function sendEmail(
  message: EmailMessage,
  deps: SendEmailDependencies = {},
): Promise<void> {
  const { config, transport } =
    deps.deliveryContext ?? getDefaultEmailDeliveryContext();

  try {
    await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch {
    throw new EmailDeliveryError();
  }
}
