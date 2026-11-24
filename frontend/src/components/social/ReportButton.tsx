"use client";

import { useState } from "react";
import { Flag, LoaderCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";

export type ReportTarget = "USER" | "POST" | "COMMENT" | "MESSAGE";

const REASONS = ["Spam or scam", "Fake identity or documents", "Harassment or abuse", "Misleading loan information", "Something else"];

/** Report a member, post, comment or message to the admins, with a short reason. */
export function ReportButton({ targetType, targetId, label = "Report", className, onDone }: { targetType: ReportTarget; targetId: string; label?: string; className?: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("busy");
    setError(null);
    const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
    const result = await api.post("/reports", { targetType, targetId, reason: text.slice(0, 200) });
    if (!result.ok) {
      setState("idle");
      setError(result.status === 409 ? "You've already reported this." : result.error);
      return;
    }
    setState("sent");
    onDone?.();
  }

  if (state === "sent") return <span className={cn("text-body-sm text-success", className)}>Reported. Thank you, our team will review it.</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-error", className)}>
        <Flag className="h-4 w-4" aria-hidden /> {label}
      </button>
    );
  }

  return (
    <div className={cn("w-full space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-sm sm:w-80", className)}>
      <p className="text-label-md font-semibold text-on-surface">Why are you reporting this?</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-body-sm">
        {REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <textarea rows={2} maxLength={150} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" aria-label="Details" className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-body-sm" />
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-space-sm">
        <button type="button" onClick={send} disabled={state === "busy"} className="inline-flex items-center gap-1 rounded-lg bg-error px-3 py-1.5 text-label-md font-semibold text-on-error disabled:opacity-60">
          {state === "busy" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Send report
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-label-md text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
      </div>
    </div>
  );
}
