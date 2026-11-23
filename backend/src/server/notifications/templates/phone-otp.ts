export interface PhoneOtpEmailInput {
  otp: string;
  phone: string;
  expiresInSeconds: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Local dev delivery uses email (Mailpit) until an SMS provider is added. */
export function renderPhoneOtpEmail({
  otp,
  phone,
  expiresInSeconds,
}: PhoneOtpEmailInput) {
  const minutes = Math.ceil(expiresInSeconds / 60);

  return {
    subject: "Your SME Connect phone verification code",
    text: [
      `Your SME Connect phone verification code is ${otp}.`,
      `It expires in ${minutes} minutes and is for ${phone}.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: [
      "<p>Your SME Connect phone verification code is " +
        `<strong>${otp}</strong>.</p>`,
      `<p>It expires in ${minutes} minutes and is for ${escapeHtml(phone)}.</p>`,
      "<p>If you did not request this, you can ignore this email.</p>",
    ].join(""),
  };
}
