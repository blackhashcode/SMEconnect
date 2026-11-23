"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "soft" | "success";

/**
 * One admin action button (suspend, pause, remove...). Asks for confirmation,
 * and for a written reason when `reason` is set (sent as `reasonField`), then
 * refreshes the page so the server-rendered data updates.
 */
export function AdminAction({
  endpoint,
  method = "POST",
  label,
  confirm,
  reason,
  reasonField = "reason",
  extraBody,
  variant = "outline",
  icon,
}: {
  endpoint: string;
  method?: "POST" | "DELETE";
  label: string;
  confirm: string;
  /** Prompt shown when a written reason is required. */
  reason?: string;
  reasonField?: string;
  extraBody?: Record<string, unknown>;
  variant?: Variant;
  icon?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (reason && text.trim().length < 5) return setError("Write at least a few words.");
    setBusy(true);
    setError(null);
    const body = { ...(extraBody ?? {}), ...(reason ? { [reasonField]: text.trim() } : {}) };
    const result = method === "DELETE" ? await api.delete(endpoint) : await api.post(endpoint, body);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    setText("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {icon} {label}
      </Button>
    );
  }

  return (
    <div className="w-full space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-sm sm:w-80">
      <p className="text-body-sm font-semibold text-on-surface">{confirm}</p>
      {reason && (
        <textarea
          rows={2}
          maxLength={500}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={reason}
          aria-label={reason}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-space-sm py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
        />
      )}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-space-sm">
        <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
