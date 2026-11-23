import Link from "next/link";
import { Activity, BadgeCheck, Ban, Flag, Handshake, Landmark, TriangleAlert, Users } from "lucide-react";
import { AdminTable, Cell, dateTime } from "@/components/admin/AdminTable";
import { Card, SectionHeading } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { adminStats, auditLogs, describeAction } from "@/lib/admin";
import { formatBDTCompact } from "@/lib/format";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const [stats, recent] = await Promise.all([adminStats(), auditLogs({ limit: 12 })]);
  if (!stats) return <p className="text-body-md text-on-surface-variant">Couldn&apos;t load platform statistics.</p>;

  const todo = [
    { href: "/admin/verification", label: "Verifications waiting", count: stats.verifications.pending, icon: BadgeCheck },
    { href: "/admin/reports", label: "Open reports", count: stats.reports.byStatus.OPEN, icon: Flag },
    { href: "/admin/loans?view=loans&status=ACTIVE", label: "Overdue instalments", count: stats.repayments.overdueCount, icon: TriangleAlert },
  ];

  return (
    <div className="space-y-space-lg">
      <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Members" value={String(stats.users.total)} hint={`${stats.users.byRole.OWNER} owners · ${stats.users.byRole.INVESTOR} investors`} />
        <StatCard icon={Handshake} label="Open requests" value={String(stats.loanRequests.byStatus.OPEN + stats.loanRequests.byStatus.IN_DISCUSSION)} hint={`${stats.offers.total} offers made in total`} tone="secondary" />
        <StatCard icon={Landmark} label="Funded loans" value={String(stats.loans.fundedCount)} hint={`${formatBDTCompact(stats.loans.totalPrincipalBdt)} principal`} tone="success" />
        <StatCard icon={Ban} label="Suspended" value={String(stats.users.byStatus.SUSPENDED)} hint={`${stats.moderation.removedPosts} posts · ${stats.moderation.removedComments} comments removed`} tone="warning" />
      </div>

      <div className="grid gap-space-lg lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-space-lg">
          <SectionHeading title="Needs attention" />
          <ul className="mt-space-md space-y-space-sm">
            {todo.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-space-sm rounded-xl px-space-sm py-2 transition-colors hover:bg-surface-container-low">
                  <item.icon className="h-4 w-4 text-primary" aria-hidden />
                  <span className="flex-1 text-body-md text-on-surface">{item.label}</span>
                  <span className={item.count > 0 ? "rounded-full bg-error px-2 text-label-md font-bold leading-6 text-on-error" : "text-label-md text-outline"}>{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-space-md border-t border-surface-container-high pt-space-md text-body-sm text-on-surface-variant">
            Repayments confirmed on time: <strong className="text-on-surface">{stats.repayments.onTimeRatePct}%</strong> of {stats.repayments.confirmedCount}
          </div>
        </Card>

        <section className="space-y-space-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-headline-sm text-on-surface"><Activity className="h-5 w-5 text-primary" aria-hidden /> Latest activity</h2>
            <Link href="/admin/activity" className="text-label-md font-semibold text-primary hover:underline">Full log</Link>
          </div>
          <AdminTable head={["When", "Who", "What"]} empty={recent.items.length === 0}>
            {recent.items.map((entry) => (
              <tr key={entry.id}>
                <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(entry.createdAt)}</Cell>
                <Cell>{entry.actor ? <Link href={`/admin/users/${entry.actor.id}`} className="font-semibold hover:underline">{entry.actor.name}</Link> : "System"}</Cell>
                <Cell>{describeAction(entry.action)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </section>
      </div>
    </div>
  );
}
