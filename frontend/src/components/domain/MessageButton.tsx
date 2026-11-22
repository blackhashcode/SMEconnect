"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/client-api";
import type { ThreadView } from "@/data/types";

/** Opens (or reuses) a conversation with a member and jumps to it in Messages. */
export function MessageButton({
  participantId,
  subject,
  children,
  variant = "outline",
  size = "md",
  className,
}: {
  participantId: string;
  subject?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setPending(true);
    setError(null);
    const result = await postJson<{ thread: ThreadView }>("/api/threads", { participantId, subject });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/messages?thread=${result.data.thread.id}`);
  }

  return (
    <span className="inline-flex flex-col">
      <Button type="button" variant={variant} size={size} className={className} onClick={open} disabled={pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      {error && <span role="alert" className="mt-1 text-body-sm text-error">{error}</span>}
    </span>
  );
}
