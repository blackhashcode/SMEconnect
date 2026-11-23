import Link from "next/link";
import { CheckCircle2, Flag, XCircle } from "lucide-react";
import { AdminAction } from "@/components/admin/AdminAction";
import { FilterChips, NextPage, StatusBadge, dateTime } from "@/components/admin/AdminTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminReport, adminReports, type AdminReportDetail } from "@/lib/admin";

export const metadata = { title: "Reports · Admin" };

function TargetSnapshot({ target }: { target: AdminReportDetail["target"] }) {
  if (!target) return <p className="text-body-sm text-outline">The reported item no longer exists.</p>;
  if (target.targetType === "USER") {
    return <p className="text-body-sm">Member: <Link href={`/admin/users/${target.targetId}`} className="font-semibold text-primary hover:underline">{target.name}</Link> ({target.role.toLowerCase()}, {target.status.toLowerCase()})</p>;
  }
  const text = target.targetType === "MESSAGE" ? target.body : target.content;
  const authorId = target.targetType === "MESSAGE" ? target.senderId : target.authorId;
  return (
    <div className="rounded-xl bg-surface-container-low p-space-sm text-body-sm">
      <p className="text-label-sm uppercase tracking-wide text-outline">
        {target.targetType.toLowerCase()} by <Link href={`/admin/users/${authorId}`} className="text-primary hover:underline">this member</Link>
        {target.deletedAt ? " · already removed" : ""}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-on-surface">{text}</p>
    </div>
  );
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; cursor?: string }> }) {
  const params = await searchParams;
  const status = params.status ?? "OPEN";
  const { items, nextCursor } = await adminReports({ status: status === "ALL" ? undefined : status, cursor: params.cursor });
  // Load each report's target snapshot so admins can decide without leaving the page.
  const details = await Promise.all(items.map((report) => adminReport(report.id)));

  return (
    <div className="space-y-space-md">
      <FilterChips base="/admin/reports" param="status" current={status === "OPEN" && !params.status ? "OPEN" : status} options={[{ value: "OPEN", label: "Open" }, { value: "RESOLVED", label: "Resolved" }, { value: "DISMISSED", label: "Dismissed" }]} />
      {items.length === 0 ? (
        <EmptyState icon={Flag} title="No reports here" description={status === "OPEN" ? "Nothing is waiting for review." : "No reports with this status."} />
      ) : (
        items.map((report, i) => {
          const detail = details[i];
          return (
            <Card key={report.id} className="space-y-space-sm p-space-lg">
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <StatusBadge status={report.status} />
                  <span className="text-label-md font-semibold text-on-surface">Reported {report.targetType.toLowerCase()}</span>
                </div>
                <span className="text-body-sm text-outline">{dateTime(report.createdAt)} · by <Link href={`/admin/users/${report.reporterId}`} className="text-primary hover:underline">reporter</Link></span>
              </div>
              <p className="text-body-md text-on-surface"><span className="font-semibold">Reason:</span> {report.reason}</p>
              {detail && <TargetSnapshot target={detail.target} />}
              {report.resolutionNote && <p className="text-body-sm text-on-surface-variant">Resolution: {report.resolutionNote}</p>}
              {report.status === "OPEN" && (
                <div className="flex flex-wrap gap-space-sm pt-space-sm">
                  <AdminAction endpoint={`/admin/reports/${report.id}/resolve`} label="Resolve & remove content" variant="secondary" reasonField="resolutionNote" reason="What you found and did" extraBody={{ moderationAction: "REMOVE_CONTENT" }} confirm="Remove the reported content and resolve this report?" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} />
                  <AdminAction endpoint={`/admin/reports/${report.id}/resolve`} label="Resolve & suspend member" reasonField="resolutionNote" reason="What you found and did" extraBody={{ moderationAction: "SUSPEND_USER" }} confirm="Suspend the member responsible and resolve this report?" />
                  <AdminAction endpoint={`/admin/reports/${report.id}/resolve`} label="Resolve, no action" variant="ghost" reasonField="resolutionNote" reason="Why no action is needed" extraBody={{ moderationAction: "NONE" }} confirm="Resolve without moderation?" />
                  <AdminAction endpoint={`/admin/reports/${report.id}/dismiss`} label="Dismiss" variant="ghost" reasonField="resolutionNote" reason="Why this report is dismissed" confirm="Dismiss this report?" icon={<XCircle className="h-4 w-4" aria-hidden />} />
                </div>
              )}
            </Card>
          );
        })
      )}
      <NextPage base="/admin/reports" cursor={nextCursor} params={{ status: params.status }} />
    </div>
  );
}
