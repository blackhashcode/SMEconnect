"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormAlert, FormField } from "./FormField";
import { api, type FieldErrors } from "@/lib/client-api";

type DemoAccount = { label: string; email: string };

export function LoginForm({
  nextPath,
  notice,
  demo,
}: {
  nextPath: string;
  notice?: string;
  demo?: { password: string; accounts: DemoAccount[] };
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

      {demo && (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-space-md">
          <p className="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
            <Sparkles className="h-4 w-4 text-secondary" aria-hidden /> Try a demo account
          </p>
          <p className="mt-0.5 text-body-sm text-outline">Development only. Fills in a seeded member&apos;s details.</p>
          <div className="mt-space-sm flex flex-wrap gap-space-sm">
            {demo.accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(demo.password);
                  setError(null);
                  setFields({});
                }}
                className="rounded-full bg-surface-container-lowest px-space-md py-1.5 text-label-md font-semibold text-primary shadow-sm transition-all hover:bg-primary-fixed active:scale-[0.97]"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
