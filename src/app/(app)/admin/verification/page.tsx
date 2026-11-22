/* eslint-disable @next/next/no-img-element */
import { BadgeCheck, CheckCircle2, Clock3, FileCheck2, Fingerprint, Search, ShieldCheck, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeading } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { VerificationCard } from "@/components/domain/VerificationCard";
import { images } from "@/data/images";
import { personById } from "@/data/users";
import { verificationCases } from "@/data/verification";

import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton as AdminBack } from "@/components/ui/Button";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Admin verification" };

export default async function AdminVerificationPage() {
  const viewer = await requireUser("/admin/verification");
  if (viewer.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admins only"
        description="The verification panel is for the SME Connect verification team."
        action={<AdminBack href="/feed">Back to your feed</AdminBack>}
      />
    );
  }
  const pending = verificationCases.filter((item) => item.status === "pending");
  const selected = verificationCases[0];
  const person = personById(selected.personId);
  const approved = verificationCases.filter((item) => item.status === "approved").length + 141;
  const rejected = verificationCases.filter((item) => item.status === "rejected").length + 2;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary"><ShieldCheck className="h-5 w-5" aria-hidden /></span><p className="text-label-sm font-bold uppercase tracking-wider text-primary">Super admin · Dhaka ops</p></div>
          <h1 className="mt-space-sm text-headline-lg text-on-surface">Verification & compliance portal</h1>
          <p className="mt-1 max-w-3xl text-body-md text-on-surface-variant">Review NID, trade licence and merchant records before issuing a verified badge.</p>
        </div>
        <div className="flex items-center gap-space-sm rounded-full bg-success-container px-space-md py-2 text-body-sm text-success"><span className="h-2 w-2 rounded-full bg-success" /> Live registry sync</div>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Pending review" value={String(pending.length + 20)} hint="Urgent queue: 3" tone="warning" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approved)} hint="+18 this month" tone="success" />
        <StatCard icon={XCircle} label="Rejected / audited" value={String(rejected)} hint="2 resubmissions" tone="secondary" />
        <StatCard icon={ShieldCheck} label="SLA adherence" value="98.6%" hint="Average turnaround 42m" />
      </div>

      <div className="mt-space-lg grid gap-space-lg xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section>
          <SectionHeading eyebrow="Queue" title="Pending verification cases" description="Ordered by submission time and risk flag." />
          <div className="mt-space-md flex flex-wrap gap-space-sm">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
              <input placeholder="Search applicant or business…" aria-label="Search verification queue" className="w-full rounded-full bg-surface-container-lowest py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary card-shadow" />
            </label>
            <select aria-label="Role filter" className="rounded-full bg-surface-container-lowest px-space-md py-2.5 text-label-md font-semibold text-on-surface card-shadow"><option>All roles</option><option>Business owners</option><option>Investors</option></select>
            <select aria-label="Document filter" className="rounded-full bg-surface-container-lowest px-space-md py-2.5 text-label-md font-semibold text-on-surface card-shadow"><option>All documents</option><option>Smart NID</option><option>Trade licence</option></select>
          </div>
          <div className="mt-space-md space-y-space-sm">
            {verificationCases.map((item) => <VerificationCard key={item.id} item={item} />)}
          </div>
        </section>

        <aside className="space-y-space-md">
          <Card className="overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-primary via-primary-container to-secondary-container" />
            <div className="-mt-10 px-space-lg pb-space-lg">
              <Avatar src={person?.avatar ?? images["avatar-placeholder"]} alt={person?.name ?? "Applicant"} size="xl" className="ring-4 ring-surface-container-lowest" />
              <div className="mt-space-sm flex flex-wrap items-center gap-2">
                <h2 className="text-headline-md text-on-surface">{person?.name}</h2>
                <Badge tone="success">NID authenticated</Badge>
                <Badge tone="primary">Fast track</Badge>
              </div>
              <p className="mt-1 text-body-md text-on-surface-variant">{selected.businessName} · {selected.type}</p>
              <p className="mt-1 text-body-sm text-outline">Submitted {selected.submittedAt}</p>
            </div>
          </Card>

          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><Fingerprint className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Cross-verification checklist</h2></div>
            <div className="mt-space-md space-y-space-sm">
              {[
                { label: "NID biometric match", value: 99.4, text: "99.4% match" },
                { label: "Trade licence registry", value: 100, text: "Valid record" },
                { label: "Merchant inflow", value: 92, text: "৳285,000 / mo" },
                { label: "Physical premises", value: 100, text: "GPS verified" },
              ].map((check) => (
                <div key={check.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-body-sm"><span className="text-on-surface-variant">{check.label}</span><span className="flex items-center gap-1 font-bold text-success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {check.text}</span></div>
                  <ProgressBar value={check.value} showValue={false} tone="success" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-space-lg">
            <div className="flex items-center gap-space-sm"><FileCheck2 className="h-5 w-5 text-primary" aria-hidden /><h2 className="text-headline-sm text-on-surface">Submitted documents</h2></div>
            <div className="mt-space-md grid gap-space-sm sm:grid-cols-2">
              {selected.documents.map((doc) => (
                <div key={doc} className="flex items-center justify-between rounded-xl bg-surface-container-low p-space-sm text-body-sm"><span className="text-on-surface-variant">{doc}</span><Button variant="ghost" size="sm">View</Button></div>
              ))}
            </div>
            <div className="mt-space-md flex flex-wrap justify-end gap-space-sm border-t border-surface-container-high pt-space-md">
              <Button variant="ghost">Request info</Button>
              <Button variant="ghost" className="text-error">Reject</Button>
              <Button variant="success"><BadgeCheck className="h-4 w-4" aria-hidden /> Approve</Button>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
