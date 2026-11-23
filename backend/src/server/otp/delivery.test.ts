import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOtp } from "@/server/otp/delivery";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendOtp delivery abstraction", () => {
  it("uses the injected provider without leaking the OTP to console logs", async () => {
    vi.stubEnv("OTP_DELIVERY_PROVIDER", "console");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const channel = await sendOtp({
      to: "+8801712345678",
      otp: "123456",
      purpose: "phone-verification",
      expiresInSeconds: 300,
    });

    expect(channel).toBe("console");
    expect(info).toHaveBeenCalledOnce();
    expect(JSON.stringify(info.mock.calls)).not.toContain("123456");
  });

  it("reports the selected channel from an injected provider", async () => {
    const send = vi.fn(async () => {});
    const channel = await sendOtp(
      {
        to: "+8801712345678",
        otp: "123456",
        purpose: "phone-verification",
        expiresInSeconds: 300,
      },
      { provider: { channel: "sms", send } },
    );

    expect(send).toHaveBeenCalledOnce();
    expect(channel).toBe("sms");
  });
});
