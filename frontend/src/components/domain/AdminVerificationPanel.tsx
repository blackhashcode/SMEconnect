"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, CheckCircle2, Clock3, FileCheck2, FileText, LoaderCircle, Search, ShieldCheck, X, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { FormAlert } from "@/components/auth/FormField";
import { postJson } from "@/lib/client-api";
import type { AdminVerificationCase } from "@/data/types";

const riskTone = { low: "success", medium: "warning", high: "error" } as const;

export function AdminVerificationPanel({ initialCases }: { initialCases: AdminVerificationCase[] }) {
  const router = useRouter();
  const [cases, setCases] = useState<AdminVerificationCase[]>(initialCases);
  const [selectedId, setSelectedId] = useState<string>(initialCases[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "Business" | "Investor">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewNote, setReviewNote] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((item) => {
      if (roleFilter !== "all" && item.type !== roleFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q && !`${item.personName} ${item.businessName} ${item.nid} ${item.tradeLicense}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [cases, query, roleFilter, statusFilter]);

  const selected = cases.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const pendingCount = cases.filter((c) => c.status === "pending").length;
  const approvedCount = cases.filter((c) => c.status === "approved").length;
  const rejectedCount = cases.filter((c) => c.status === "rejected").length;

  async function decide(caseId: string, decision: "approved" | "rejected") {
    setPendingId(caseId);
    setError(null);
    const result = await postJson<{ id: string; status: "approved" | "rejected"; reviewNote: string | null }>(
      `/api/v1/admin/verifications/${encodeURIComponent(caseId)}/review`,
      { decision, note: reviewNote.trim() || undefined },
    );
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCases((prev) =>
      prev.map((item) =>
        item.id === caseId
          ? { ...item, status: result.data.status, reviewNote: result.data.reviewNote ?? undefined }
          : item,
      ),
    );
    setReviewNote("");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Super admin · Dhaka ops</p>
          </div>
          <h1 className="mt-space-sm text-headline-lg text-on-surface">Verification &amp; compliance portal</h1>
          <p className="mt-1 max-w-3xl text-body-md text-on-surface-variant">
            Review NID, trade licence and merchant records before issuing a verified badge.
          </p>
        </div>
        <div className="flex items-center gap-space-sm rounded-full bg-success-container px-space-md py-2 text-body-sm text-success">
          <span className="h-2 w-2 rounded-full bg-success" /> Live database queue
        </div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Pending review" value={String(pendingCount)} hint="Awaiting admin decision" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approvedCount)} hint="Verified members" tone="success" />
        <StatCard icon={XCircle} label="Rejected" value={String(rejectedCount)} hint="Needs resubmission" tone="secondary" />
        <StatCard icon={ShieldCheck} label="Total cases" value={String(cases.length)} hint="Audited in database" />
      </div>

      {error && (
        <div className="mt-space-md">
          <FormAlert>{error}</FormAlert>
        </div>
      )}

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section>
          <SectionHeading eyebrow="Queue" title="Verification cases" description="Select a case to inspect documents and approve or reject." />
          <div className="mt-space-md flex flex-wrap gap-space-sm">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search applicant, business or NID…"
                aria-label="Search verification queue"
                className="w-full rounded-full bg-surface-container-lowest py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary card-shadow"
              />
            </label>
            <select
              aria-label="Role filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | "Business" | "Investor")}
              className="rounded-full bg-surface-container-lowest px-space-md py-2.5 text-label-md font-semibold text-on-surface card-shadow"
            >
              <option value="all">All roles</option>
              <option value="Business">Business owners</option>
              <option value="Investor">Investors</option>
            </select>
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "approved" | "rejected")}
              className="rounded-full bg-surface-container-lowest px-space-md py-2.5 text-label-md font-semibold text-on-surface card-shadow"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="mt-space-md space-y-space-sm">
            {filtered.length === 0 && (
              <Card className="p-space-lg text-center text-body-md text-on-surface-variant">
                No verification cases match your filter.
              </Card>
            )}
            {filtered.map((item) => (
              <article
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`cursor-pointer rounded-2xl bg-surface-container-lowest p-space-lg card-shadow transition-all ${
                  selected?.id === item.id ? "ring-2 ring-primary" : "hover:bg-surface-container-low/50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-space-md">
                  <div className="flex items-start gap-space-md">
                    <Avatar src={item.personAvatar} alt={item.personName} size="lg" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-headline-sm text-on-surface">{item.personName}</p>
                        <Badge tone={riskTone[item.risk]}>{item.risk} risk</Badge>
                      </div>
                      <p className="mt-0.5 text-body-md text-on-surface-variant">
                        {item.businessName} · {item.type}
                      </p>
                      <p className="mt-1 text-body-sm text-outline">
                        Submitted <TimeAgo iso={item.submittedAt} />
                      </p>
                    </div>
                  </div>
                  <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "error" : "warning"}>
                    {item.status}
                  </Badge>
                </div>

                <dl className="mt-space-md grid gap-space-sm rounded-xl bg-surface-container-low p-space-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-label-sm text-outline">NID</dt>
                    <dd className="text-label-md font-semibold text-on-surface">{item.nid}</dd>
                  </div>
                  <div>
                    <dt className="text-label-sm text-outline">Trade licence</dt>
                    <dd className="text-label-md font-semibold text-on-surface">{item.tradeLicense}</dd>
                  </div>
                </dl>

                <div className="mt-space-md flex flex-wrap gap-space-sm">
                  {item.documents.map((doc) => (
                    <span
                      key={doc}
                      className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-sm py-1 text-body-sm text-on-surface-variant"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden /> {doc}
                    </span>
                  ))}
                </div>

                <div className="mt-space-md flex flex-wrap items-center justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error-container"
                    disabled={pendingId === item.id || item.status === "rejected"}
                    onClick={(e) => {
                      e.stopPropagation();
                      decide(item.id, "rejected");
                    }}
                  >
                    {pendingId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={pendingId === item.id || item.status === "approved"}
                    onClick={(e) => {
                      e.stopPropagation();
                      decide(item.id, "approved");
                    }}
                  >
                    {pendingId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                    Approve
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-space-md">
          {selected && (
            <>
              <Card className="overflow-hidden">
                <div className="h-28 bg-gradient-to-r from-primary via-primary-container to-secondary-container" />
                <div className="-mt-10 px-space-lg pb-space-lg">
                  <Avatar src={selected.personAvatar} alt={selected.personName} size="xl" className="ring-4 ring-surface-container-lowest" />
                  <div className="mt-space-sm flex flex-wrap items-center gap-2">
                    <h2 className="text-headline-md text-on-surface">{selected.personName}</h2>
                    <Badge tone={selected.status === "approved" ? "success" : selected.status === "rejected" ? "error" : "warning"}>
                      {selected.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-body-md text-on-surface-variant">
                    {selected.businessName} · {selected.type}
                  </p>
                  <p className="mt-1 text-body-sm text-outline">
                    {selected.personLocation || "Bangladesh"} · Submitted <TimeAgo iso={selected.submittedAt} />
                  </p>
                  {selected.reviewNote && (
                    <p className="mt-space-sm rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
                      Review note: {selected.reviewNote}
                    </p>
                  )}
                </div>
              </Card>

              <Card className="p-space-lg">
                <div className="flex items-center gap-space-sm">
                  <FileCheck2 className="h-5 w-5 text-primary" aria-hidden />
                  <h2 className="text-headline-sm text-on-surface">Decision &amp; audit note</h2>
                </div>
                <label className="mt-space-md block">
                  <span className="mb-1 block text-label-sm font-bold text-outline">Optional note (saved to audit log &amp; sent to applicant)</span>
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="e.g. Verified NID and Dhaka South City Corporation trade licence."
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-2.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                </label>
                <div className="mt-space-md flex flex-wrap justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
                  <Button
                    variant="ghost"
                    className="text-error"
                    disabled={pendingId === selected.id || selected.status === "rejected"}
                    onClick={() => decide(selected.id, "rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    disabled={pendingId === selected.id || selected.status === "approved"}
                    onClick={() => decide(selected.id, "approved")}
                  >
                    <BadgeCheck className="h-4 w-4" aria-hidden /> Approve &amp; verify
                  </Button>
                </div>
              </Card>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
