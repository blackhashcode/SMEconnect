import { AppError } from "@/server/errors";
import { sendEmail } from "@/server/notifications/email";
import { renderPhoneOtpEmail } from "@/server/notifications/templates/phone-otp";

export type OtpPurpose = "phone-verification";
export type OtpDeliveryChannel = "email" | "console" | "sms";

/**
 * Delivery abstraction for one-time passwords. An SMS provider can be added
 * by implementing this interface and selecting it in `getOtpDeliveryProvider`.
 */
export interface OtpDeliveryProvider {
  readonly channel: OtpDeliveryChannel | "sms";
  send(request: SendOtpRequest): Promise<void>;
}

export interface SendOtpRequest {
  /** Normalized phone number; SMS providers will use this as the destination. */
  to: string;
  otp: string;
  purpose: OtpPurpose;
  expiresInSeconds: number;
  /** Local dev email delivery needs the account email; SMS providers ignore it. */
  email?: string;
}

export interface SendOtpDependencies {
  provider?: OtpDeliveryProvider;
}

const emailOtpProvider: OtpDeliveryProvider = {
  channel: "email",
  async send(request) {
    if (!request.email) {
      throw new AppError(
        "OTP_DELIVERY_ERROR",
        "An email address is required for local OTP delivery",
        500,
      );
    }

    const rendered = renderPhoneOtpEmail({
      otp: request.otp,
      phone: request.to,
      expiresInSeconds: request.expiresInSeconds,
    });

    await sendEmail({
      to: request.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
  },
};

const consoleOtpProvider: OtpDeliveryProvider = {
  channel: "console",
  async send(request) {
    // Never log the OTP itself. Console mode only confirms that a code was
    // prepared, so it cannot leak a usable secret into deployment logs.
    console.info("Phone OTP prepared", {
      purpose: request.purpose,
      phoneTail: request.to.slice(-2),
      expiresInSeconds: request.expiresInSeconds,
    });
  },
};

export function getOtpDeliveryProvider(): OtpDeliveryProvider {
  const configured = process.env.OTP_DELIVERY_PROVIDER?.trim().toLowerCase() || "email";

  if (configured === "email") return emailOtpProvider;
  if (configured === "console") return consoleOtpProvider;

  throw new AppError(
    "OTP_CONFIG_ERROR",
    "Unsupported OTP delivery provider",
    500,
  );
}

/** Single entry point used by the phone OTP service. */
export async function sendOtp(
  request: SendOtpRequest,
  deps: SendOtpDependencies = {},
): Promise<OtpDeliveryChannel> {
  const provider = deps.provider ?? getOtpDeliveryProvider();
  await provider.send(request);
  return provider.channel;
}
