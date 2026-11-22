"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function ConnectButton({ name, className }: { name: string; className?: string }) {
  const [connected, setConnected] = useState(false);

  return (
    <Button
      variant={connected ? "soft" : "primary"}
      className={cn("min-w-[120px]", className)}
      onClick={() => setConnected((value) => !value)}
      aria-pressed={connected}
    >
      {connected ? <Check className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
      {connected ? "Connected" : `Connect ${name.split(" ")[0]}`}
    </Button>
  );
}
