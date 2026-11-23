import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { backendGet } from "@/lib/backend/server";
import type { components } from "@/lib/backend/schema";
import { requireUser } from "@/lib/session";

type Stats = components["schemas"]["AdminStats"];

/** Every /admin page: admins only, with the section tabs and queue counts. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireUser("/admin");
  if (viewer.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admins only"
        description="This area is for the SME Connect team."
        action={<LinkButton href="/feed">Back to your feed</LinkButton>}
      />
    );
  }
  const stats = (await backendGet<Stats>("/admin/stats")).data;

  return (
    <div className="space-y-space-lg">
      <div>
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Administration</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Admin panel</h1>
      </div>
      <AdminNav openReports={stats?.reports.byStatus.OPEN ?? 0} pendingVerifications={stats?.verifications.pending ?? 0} />
      {children}
    </div>
  );
}
