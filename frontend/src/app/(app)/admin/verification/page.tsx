import { CheckCircle2, ClipboardList, ShieldAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { VerificationCard } from "@/components/domain/VerificationCard";
import { backendGet } from "@/lib/backend/server";
import { verificationQueue } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { components } from "@/lib/backend/schema";

export const metadata = { title: "Admin verification" };

type AdminUser = components["schemas"]["AdminUserDetail"];
type Stats = components["schemas"]["AdminStats"];

export default async function AdminVerificationPage() {
  const viewer = await requireUser("/admin/verification");
  if (viewer.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admins only"
        description="The verification panel is for the SME Connect verification team."
        action={<LinkButton href="/feed">Back to your feed</LinkButton>}
      />
    );
  }

  const [pending, recent, stats] = await Promise.all([
    verificationQueue("PENDING"),
    verificationQueue("APPROVED"),
    backendGet<Stats>("/admin/stats").then((res) => res.data),
  ]);
  // The queue carries user ids; look the applicants up in parallel.
  const ids = [...new Set(pending.map((item) => item.userId))];
  const users = await Promise.all(ids.map((id) => backendGet<AdminUser>(`/admin/users/${id}`).then((res) => res.data)));
  const applicants = new Map(users.filter((user): user is AdminUser => user !== null).map((user) => [user.id, { name: user.name, email: user.email }]));
  const counts = (stats ?? {}) as { users?: { total?: number } };

  return (
    <>
      <div>
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Administration</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Verification queue</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Check identity and sales documents before members can publish requests or make offers.</p>
      </div>

      <div className="mt-space-lg grid gap-space-md sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Waiting for review" value={String(pending.length)} tone="warning" />
        <StatCard icon={CheckCircle2} label="Recently approved" value={String(recent.length)} tone="success" />
        <StatCard icon={Users} label="Members" value={counts.users?.total !== undefined ? String(counts.users.total) : "—"} />
      </div>

      <div className="mt-space-lg space-y-space-md">
        {pending.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All caught up" description="There are no verification submissions waiting for review." />
        ) : (
          pending.map((item) => <VerificationCard key={item.id} item={item} applicant={applicants.get(item.userId) ?? null} />)
        )}
      </div>
    </>
  );
}
