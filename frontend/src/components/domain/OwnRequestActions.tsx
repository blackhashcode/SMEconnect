"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import type { OwnLoanRequest } from "@/data/types";

/** Lifecycle buttons for the owner's own request (publish, pause, resume, cancel). */
export function OwnRequestActions({ request }: { request: OwnLoanRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions: { key: string; label: string; variant: "secondary" | "soft" | "ghost"; confirm?: string }[] = [];
  if (request.status === "DRAFT") actions.push({ key: "publish", label: "Publish", variant: "secondary" });
  if (request.status === "PAUSED") actions.push({ key: "resume", label: "Resume", variant: "secondary" });
  if (request.status === "OPEN" || request.status === "IN_DISCUSSION") actions.push({ key: "pause", label: "Pause", variant: "soft" });
  if (["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED"].includes(request.status)) {
    actions.push({ key: "cancel", label: "Cancel request", variant: "ghost", confirm: "Cancel this loan request? Pending offers will be closed." });
  }

  async function run(key: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    const result = await api.post(`/me/loan-requests/${request.id}/${key}`);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!actions.length) return null;
  return (
    <div className="flex flex-col items-stretch gap-space-sm">
      {actions.map((action) => (
        <Button key={action.key} variant={action.variant} size="sm" onClick={() => run(action.key, action.confirm)} disabled={busy !== null} className={action.key === "cancel" ? "text-error hover:bg-error-container" : undefined}>
          {busy === action.key && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} {action.label}
        </Button>
      ))}
      {error && <p role="alert" className="max-w-[16rem] text-body-sm text-error">{error}</p>}
    </div>
  );
}
