import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EmailDeliveryError,
  toErrorPayload,
} from "@/server/errors";
import { sendEmail, type EmailMessage } from "@/server/notifications/email";
import {
  createSmtpTransport,
  getDefaultEmailDeliveryContext,
  readEmailConfig,
  resetDefaultEmailDeliveryContext,
  type EmailConfig,
} from "@/server/notifications/smtp";

const validEnv: Record<string, string | undefined> = {
  EMAIL_FROM: "SME Connect <no-reply@localhost>",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
};

const config: EmailConfig = {
  from: "SME Connect <no-reply@localhost>",
  host: "localhost",
  port: 1025,
  secure: false,
};

const message: EmailMessage = {
  to: "owner@example.com",
  subject: "Verify your SME Connect email",
  text: "Your code is 123456",
  html: "<p>Your code is 123456</p>",
};

describe("readEmailConfig", () => {
  it("reads a valid local SMTP configuration", () => {
    expect(readEmailConfig(validEnv)).toEqual(config);
  });

  it("enables TLS implicitly on port 465", () => {
    expect(readEmailConfig({ ...validEnv, SMTP_PORT: "465" })).toMatchObject({
      port: 465,
      secure: true,
    });
  });

  it("passes credentials only when both variables are present", () => {
    expect(
      readEmailConfig({
        ...validEnv,
        SMTP_USER: "smtp-user",
        SMTP_PASSWORD: "smtp-password",
      }),
    ).toMatchObject({
      user: "smtp-user",
      password: "smtp-password",
    });
  });

  const invalidCases: Array<[Record<string, string | undefined>, string]> = [
    [{ ...validEnv, EMAIL_FROM: undefined }, "EMAIL_FROM is not set"],
    [{ ...validEnv, EMAIL_FROM: "not-an-email" }, "EMAIL_FROM is not a valid sender"],
    [{ ...validEnv, SMTP_HOST: undefined }, "SMTP_HOST is not set"],
    [{ ...validEnv, SMTP_PORT: undefined }, "SMTP_PORT is not set"],
    [
      { ...validEnv, SMTP_PORT: "abc" },
      "SMTP_PORT must be an integer between 1 and 65535",
    ],
    [
      { ...validEnv, SMTP_PORT: "70000" },
      "SMTP_PORT must be an integer between 1 and 65535",
    ],
    [
      { ...validEnv, SMTP_USER: "smtp-user" },
      "SMTP_USER and SMTP_PASSWORD must be set together",
    ],
    [
      { ...validEnv, SMTP_PASSWORD: "smtp-password" },
      "SMTP_USER and SMTP_PASSWORD must be set together",
    ],
  ];

  it.each(invalidCases)("rejects invalid configuration: %s", (env, expected) => {
    expect(() => readEmailConfig(env)).toThrow(expected);
  });
});

describe("SMTP transport", () => {
  afterEach(() => {
    resetDefaultEmailDeliveryContext();
  });

  it("reuses one pooled transport for the default context", () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    const factory = vi.fn(() => ({ sendMail }));

    const first = getDefaultEmailDeliveryContext(validEnv, factory);
    const second = getDefaultEmailDeliveryContext(validEnv, factory);

    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        host: "localhost",
        port: 1025,
        secure: false,
      }),
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("gives credentials to the transport without exposing them elsewhere", () => {
    const factory = vi.fn(() => ({ sendMail: vi.fn() }));
    const authConfig = readEmailConfig({
      ...validEnv,
      SMTP_USER: "smtp-user",
      SMTP_PASSWORD: "smtp-password",
    });

    createSmtpTransport(authConfig, factory);

    expect(factory).toHaveBeenCalledWith({
      pool: true,
      host: "localhost",
      port: 1025,
      secure: false,
      auth: { user: "smtp-user", pass: "smtp-password" },
    });
  });
});

describe("sendEmail", () => {
  it("sends with the configured sender and supplied content", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "local-test" });

    await sendEmail(message, {
      deliveryContext: { config, transport: { sendMail } },
    });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it("replaces SMTP failures with a safe delivery error", async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValue(new Error("535 authentication failed: smtp-password"));

    const error = await sendEmail(message, {
      deliveryContext: { config, transport: { sendMail } },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect((error as Error).message).toBe("Could not deliver email");
    expect(toErrorPayload(error).body).toEqual({
      error: {
        code: "EMAIL_DELIVERY_FAILED",
        message: "Could not deliver email",
      },
    });
    expect(JSON.stringify(error)).not.toContain("535");
    expect(JSON.stringify(error)).not.toContain("smtp-password");
  });
});
