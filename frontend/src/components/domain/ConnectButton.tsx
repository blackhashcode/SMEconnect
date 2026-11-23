"use client";

import { useState } from "react";
import { Check, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";

/** Sends a connection request (the other member accepts it from their notifications). */
export function ConnectButton({ userId, name, className }: { userId: string; name: string; className?: string }) {
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function connect() {
    setState("pending");
    const result = await api.post("/connections", { addresseeId: userId });
    // 409 means a request or connection already exists, which is fine to show as sent.
    if (result.ok || result.status === 409) {
      setState("sent");
      return;
    }
    setState("error");
    setMessage(result.error);
  }

  return (
    <span className="inline-flex flex-col">
      <Button variant={state === "sent" ? "soft" : "primary"} className={cn("min-w-[120px]", className)} onClick={connect} disabled={state === "pending" || state === "sent"}>
        {state === "pending" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : state === "sent" ? <Check className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
        {state === "sent" ? "Request sent" : `Connect with ${firstName(name)}`}
      </Button>
      {message && <span role="alert" className="mt-1 text-body-sm text-error">{message}</span>}
    </span>
  );
}
