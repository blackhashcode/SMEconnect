"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteJson, postJson } from "@/lib/client-api";
import { cn } from "@/lib/cn";

export function ConnectButton({
  participantId,
  name,
  initialConnected = false,
  className,
}: {
  participantId: string;
  name: string;
  initialConnected?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const result = connected
      ? await deleteJson<{ connected: boolean }>(`/api/v1/connections/${encodeURIComponent(participantId)}`)
      : await postJson<{ connected: boolean }>("/api/v1/connections", { participantId });
    setPending(false);
    if (result.ok) {
      setConnected(result.data.connected);
      router.refresh();
    }
  }

  return (
    <Button
      variant={connected ? "soft" : "primary"}
      className={cn("min-w-[120px]", className)}
      onClick={toggle}
      disabled={pending}
      aria-pressed={connected}
    >
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
      ) : connected ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <UserPlus className="h-4 w-4" aria-hidden />
      )}
      {connected ? "Connected" : `Connect ${name.split(" ")[0]}`}
    </Button>
  );
}
