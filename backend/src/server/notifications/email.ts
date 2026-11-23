import nodemailer from "nodemailer";
import { logger } from "@/server/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}

/** Sends email via configured SMTP provider (Mailpit locally, Resend/SES in prod). */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "SME Connect <no-reply@smeconnect.local>",
      ...message,
    });
  } catch (error) {
    logger.warn("Email delivery failed (non-blocking)", {
      to: message.to,
      subject: message.subject,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
