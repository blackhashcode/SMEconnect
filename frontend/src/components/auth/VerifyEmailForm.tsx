"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormAlert, FormField } from "./FormField";
import { api } from "@/lib/client-api";

const RESEND_SECONDS = 60;

/** Enter the six-digit code sent by email; success signs the member in. */
export function VerifyEmailForm({ email, nextPath }: { email: string; nextPath: string }) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(`We sent a 6-digit code to ${email}.`);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await api.post("/auth/email-otp/verify-email", { email, otp });
    if (!result.ok) {
      setPending(false);
      setError(
        result.code === "TOO_MANY_ATTEMPTS"
          ? "Too many wrong codes. Request a new one."
          : result.code === "OTP_EXPIRED"
            ? "That code has expired. Request a new one."
            : "That code isn't right. Check the email and try again.",
      );
      return;
    }
    window.scrollTo({ top: 0 });
    router.replace(nextPath);
    router.refresh();
  }

  async function resend() {
    setError(null);
    setCooldown(RESEND_SECONDS);
    const result = await api.post("/auth/email-otp/send-verification-otp", { email, type: "email-verification" });
    setNotice(result.ok ? `A new code is on its way to ${email}.` : null);
    if (!result.ok) setError(result.status === 429 ? "Please wait a little before requesting another code." : result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-space-md">
      {notice && !error && <FormAlert tone="info">{notice}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <FormField
        label="Verification code"
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={6}
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
        required
        autoFocus
      />
      <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <MailCheck className="h-4 w-4" aria-hidden />}
        {pending ? "Verifying…" : "Verify email"}
        {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>
      <p className="text-center text-body-sm text-on-surface-variant">
        Didn&apos;t get it?{" "}
        <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-outline disabled:no-underline">
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
        </button>
      </p>
    </form>
  );
}
