import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerificationCard } from "@/components/domain/VerificationCard";
import { backendGet } from "@/lib/backend/server";
import { verificationQueue } from "@/lib/api";
import type { components } from "@/lib/backend/schema";

export const metadata = { title: "Verification · Admin" };

type AdminUser = components["schemas"]["AdminUserDetail"];

export default async function AdminVerificationPage() {
  const pending = await verificationQueue("PENDING");
  // The queue carries user ids; look the applicants up in parallel.
  const ids = [...new Set(pending.map((item) => item.userId))];
  const users = await Promise.all(ids.map((id) => backendGet<AdminUser>(`/admin/users/${id}`).then((res) => res.data)));
  const applicants = new Map(users.filter((user): user is AdminUser => user !== null).map((user) => [user.id, { name: user.name, email: user.email }]));

  return (
    <div className="space-y-space-md">
      <p className="text-body-md text-on-surface-variant">Check identity and sales documents before members can publish requests or make offers.</p>
      {pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="All caught up" description="There are no verification submissions waiting for review." />
      ) : (
        pending.map((item) => <VerificationCard key={item.id} item={item} applicant={applicants.get(item.userId) ?? null} />)
      )}
    </div>
  );
}
