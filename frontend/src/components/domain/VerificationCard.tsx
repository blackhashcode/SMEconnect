"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, LoaderCircle, X } from "lucide-react";
import { DocumentViewer } from "@/components/admin/DocumentViewer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { api } from "@/lib/client-api";
import type { AdminVerification } from "@/data/types";

/** One submission in the admin queue: documents plus approve/reject with a note. */
export function VerificationCard({ item, applicant }: { item: AdminVerification; applicant: { name: string; email: string } | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"APPROVED" | "REJECTED" | null>(null);
  const documents = [
    { label: "ID document", href: item.idDocumentUrl },
    ...item.salesProofUrls.map((href, i) => ({ label: `Sales proof ${i + 1}`, href })),
  ];

  async function review(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !note.trim()) {
      setError("Add a note so the applicant knows what to fix.");
      return;
    }
    setBusy(status);
    setError(null);
    const result = await api.post(`/admin/verifications/${item.id}`, { status, reviewNote: note.trim() || undefined });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(status);
    router.refresh();
  }

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <p className="text-headline-sm text-on-surface">{applicant?.name ?? "Unknown applicant"}</p>
          <p className="text-body-sm text-outline">{applicant?.email} · {item.type === "OWNER" ? "Business owner" : "Investor"}</p>
          <p className="mt-1 text-body-sm text-outline">Submitted <TimeAgo iso={item.submittedAt} /></p>
        </div>
        <Badge tone={item.status === "APPROVED" || done === "APPROVED" ? "success" : item.status === "REJECTED" || done === "REJECTED" ? "error" : "warning"}>
          {done ?? item.status}
        </Badge>
      </div>

      <div className="mt-space-md flex flex-wrap gap-space-sm">
        <DocumentViewer documents={documents} />
        {item.shopLinks.map((href) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-1.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-primary">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {new URL(href).hostname}
          </a>
        ))}
      </div>

      {item.status === "PENDING" && !done && (
        <div className="mt-space-md space-y-space-sm border-t border-surface-container-high pt-space-md">
          <textarea rows={2} maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Review note (required when rejecting)" className="w-full rounded-xl border border-outline-variant px-space-md py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none" />
          {error && <p role="alert" className="text-body-sm font-medium text-error">{error}</p>}
          <div className="flex flex-wrap justify-end gap-space-sm">
            <Button variant="ghost" size="sm" className="text-error hover:bg-error-container" onClick={() => review("REJECTED")} disabled={busy !== null}>
              {busy === "REJECTED" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />} Reject
            </Button>
            <Button variant="success" size="sm" onClick={() => review("APPROVED")} disabled={busy !== null}>
              {busy === "APPROVED" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Approve
            </Button>
          </div>
        </div>
      )}
      {item.reviewNote && <p className="mt-space-sm text-body-sm text-on-surface-variant">Note: {item.reviewNote}</p>}
    </article>
  );
}
