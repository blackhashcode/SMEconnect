import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton as AdminBack } from "@/components/ui/Button";
import { AdminVerificationPanel } from "@/components/domain/AdminVerificationPanel";
import { listVerificationCases } from "@/lib/api";
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

  const cases = await listVerificationCases();
  return <AdminVerificationPanel initialCases={cases} />;
}
