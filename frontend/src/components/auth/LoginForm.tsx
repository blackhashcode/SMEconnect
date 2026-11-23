"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormAlert, FormField } from "./FormField";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { api, type FieldErrors } from "@/lib/client-api";

export function LoginForm({
  nextPath,
  notice,
  googleEnabled = false,
}: {
  nextPath: string;
  notice?: string;
  /** Whether the backend has Google sign-in configured (the button always shows). */
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    const result = await api.post("/auth/sign-in/email", { email, password });
    if (!result.ok) {
      setPending(false);
      // Unverified email: send a fresh code and continue on the code page.
      if (result.code === "EMAIL_NOT_VERIFIED") {
        await api.post("/auth/email-otp/send-verification-otp", { email, type: "email-verification" });
        router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`);
        return;
      }
      setError(
        result.status === 401
          ? "That email and password don't match."
          : result.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : result.error,
      );
      setFields(result.fields);
      return;
    }
    // Moving from the public layout to the app layout; start the new page at the top.
    window.scrollTo({ top: 0 });
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-space-md">
      {notice && !error && <FormAlert tone="success">{notice}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}

      <GoogleButton nextPath={nextPath} available={googleEnabled} />
      <OrDivider />

      <FormField
        label="Email address"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fields.email?.[0]}
        required
        autoFocus
      />
      <FormField
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fields.password?.[0]}
        required
      />

      <Button type="submit" variant="secondary" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Logging in…" : "Log in"}
        {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
      </Button>

      <p className="text-center text-body-sm text-on-surface-variant">
        New to SME Connect?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create a free account
        </Link>
      </p>
    </form>
  );
}
