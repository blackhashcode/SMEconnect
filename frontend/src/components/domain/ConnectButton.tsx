"use client";

import { useState } from "react";
import { Check, Clock3, LoaderCircle, UserCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";

export type ConnectionStatus = "none" | "outgoing" | "incoming" | "connected" | "declined" | "self";

type ConnectionRecord = { id: string; status: "PENDING" | "ACCEPTED" | "DECLINED"; direction: "incoming" | "outgoing" };

/**
 * Connect / Request sent / Accept / Connected, based on the current relationship
 * (loaded on the server from GET /connections/with/:userId). Clicking Connect on
 * someone who already asked you accepts their request.
 */
export function ConnectButton({
  userId,
  name,
  initialStatus = "none",
  connectionId: initialConnectionId = null,
  className,
}: {
  userId: string;
  name: string;
  initialStatus?: ConnectionStatus;
  connectionId?: string | null;
  className?: string;
}) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [connectionId, setConnectionId] = useState(initialConnectionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = firstName(name);

  async function run(request: () => Promise<{ ok: true; data: ConnectionRecord } | { ok: false; error: string; status: number }>) {
    setBusy(true);
    setError(null);
    const result = await request();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConnectionId(result.data.id);
    setStatus(result.data.status === "ACCEPTED" ? "connected" : result.data.status === "DECLINED" ? "declined" : result.data.direction === "outgoing" ? "outgoing" : "incoming");
  }

  const connect = () => run(() => api.post<ConnectionRecord>("/connections", { addresseeId: userId }));
  const accept = () => run(() => api.post<ConnectionRecord>(`/connections/${connectionId}/accept`));
  const decline = () => run(() => api.post<ConnectionRecord>(`/connections/${connectionId}/decline`));
  const cancel = async () => {
    if (!connectionId) return;
    setBusy(true);
    const result = await api.delete(`/connections/${connectionId}`);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setStatus("none");
    setConnectionId(null);
  };

  if (status === "self") return null;
  const spinner = <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />;

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex flex-wrap gap-space-sm">
        {status === "connected" && (
          <Button variant="soft" className={cn("min-w-[120px]", className)} disabled>
            <UserCheck className="h-4 w-4" aria-hidden /> Connected
          </Button>
        )}
        {status === "outgoing" && (
          <>
            <Button variant="soft" className={cn("min-w-[120px]", className)} disabled>
              <Clock3 className="h-4 w-4" aria-hidden /> Request sent
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              {busy ? spinner : <X className="h-4 w-4" aria-hidden />} Withdraw
            </Button>
          </>
        )}
        {status === "incoming" && (
          <>
            <Button variant="primary" className={className} onClick={accept} disabled={busy}>
              {busy ? spinner : <Check className="h-4 w-4" aria-hidden />} Accept {short}&apos;s request
            </Button>
            <Button variant="ghost" onClick={decline} disabled={busy} aria-label="Decline request">
              <X className="h-4 w-4" aria-hidden /> Decline
            </Button>
          </>
        )}
        {(status === "none" || status === "declined") && (
          <Button variant="primary" className={cn("min-w-[120px]", className)} onClick={connect} disabled={busy}>
            {busy ? spinner : <UserPlus className="h-4 w-4" aria-hidden />} Connect with {short}
          </Button>
        )}
      </span>
      {error && <span role="alert" className="mt-1 text-body-sm text-error">{error}</span>}
    </span>
  );
}
