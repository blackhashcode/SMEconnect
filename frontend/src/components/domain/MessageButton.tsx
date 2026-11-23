"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import type { Conversation } from "@/data/types";

/** Opens (or reuses) a conversation with a member and jumps to it in Messages. */
export function MessageButton({
  participantId,
  children,
  variant = "outline",
  size = "md",
  className,
}: {
  participantId: string;
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
    const result = await api.post<Conversation>("/conversations", { participantId });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/messages?conversation=${result.data.id}`);
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
