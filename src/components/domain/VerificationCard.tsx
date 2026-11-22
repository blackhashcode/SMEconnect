"use client";

import { Check, FileText, ShieldAlert, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { personById } from "@/data/users";
import type { VerificationCase } from "@/data/types";

const riskTone = { low: "success", medium: "warning", high: "error" } as const;

export function VerificationCard({ item }: { item: VerificationCase }) {
  const person = personById(item.personId);
  if (!person) return null;

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <Avatar src={person.avatar} alt={person.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-headline-sm text-on-surface">{person.name}</p>
              <Badge tone={riskTone[item.risk]}>{item.risk} risk</Badge>
            </div>
            <p className="mt-0.5 text-body-md text-on-surface-variant">{item.businessName} · {item.type}</p>
            <p className="mt-1 text-body-sm text-outline">Submitted {item.submittedAt}</p>
          </div>
        </div>
        <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "error" : "neutral"}>
          {item.status}
        </Badge>
      </div>

      <dl className="mt-space-md grid gap-space-sm rounded-xl bg-surface-container-low p-space-sm sm:grid-cols-2">
        <div><dt className="text-label-sm text-outline">NID</dt><dd className="text-label-md font-semibold text-on-surface">{item.nid}</dd></div>
        <div><dt className="text-label-sm text-outline">Trade licence</dt><dd className="text-label-md font-semibold text-on-surface">{item.tradeLicense}</dd></div>
      </dl>

      <div className="mt-space-md flex flex-wrap gap-space-sm">
        {item.documents.map((doc) => (
          <span key={doc} className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-sm py-1 text-body-sm text-on-surface-variant">
            <FileText className="h-3.5 w-3.5" aria-hidden /> {doc}
          </span>
        ))}
      </div>

      <div className="mt-space-md flex flex-wrap items-center justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
        <Button variant="ghost" size="sm"><ShieldAlert className="h-4 w-4" aria-hidden /> Request more info</Button>
        <Button variant="ghost" size="sm" className="text-error hover:bg-error-container"><X className="h-4 w-4" aria-hidden /> Reject</Button>
        <Button variant="success" size="sm"><Check className="h-4 w-4" aria-hidden /> Approve</Button>
      </div>
    </article>
  );
}
