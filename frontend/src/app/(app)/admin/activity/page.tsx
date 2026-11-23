import Link from "next/link";
import { AdminTable, Cell, FilterChips, NextPage, dateTime } from "@/components/admin/AdminTable";
import { auditLogs, describeAction } from "@/lib/admin";

export const metadata = { title: "Activity log · Admin" };

const CATEGORIES = [
  { value: "auth.", label: "Sign-ins" },
  { value: "account.", label: "Accounts" },
  { value: "verification.", label: "Verification" },
  { value: "loan_request.", label: "Loan requests" },
  { value: "offer.", label: "Offers" },
  { value: "agreement.", label: "Agreements" },
  { value: "repayment.", label: "Repayments" },
  { value: "report.", label: "Reports" },
  { value: "admin.", label: "Admin actions" },
];

function summary(detail: Record<string, unknown> | null) {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([key, value]) => value !== null && value !== undefined && key !== "userAgent")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ category?: string; cursor?: string }> }) {
  const params = await searchParams;
  const category = CATEGORIES.some((c) => c.value === params.category) ? params.category : undefined;
  const { items, nextCursor } = await auditLogs({ category, cursor: params.cursor, limit: 40 });

  return (
    <div className="space-y-space-md">
      <p className="text-body-sm text-on-surface-variant">Every sign-up, sign-in, lending step and admin action, newest first. Times are Bangladesh time.</p>
      <FilterChips base="/admin/activity" param="category" current={category} options={CATEGORIES} />
      <AdminTable head={["When", "Who", "What", "Details", "IP address"]} empty={items.length === 0}>
        {items.map((entry) => (
          <tr key={entry.id}>
            <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(entry.createdAt)}</Cell>
            <Cell>
              {entry.actor ? <Link href={`/admin/users/${entry.actor.id}`} className="font-semibold hover:underline">{entry.actor.name}</Link> : "System"}
              {entry.actor?.role && <p className="text-on-surface-variant">{entry.actor.role.toLowerCase()}</p>}
            </Cell>
            <Cell>{describeAction(entry.action)}</Cell>
            <Cell className="max-w-[320px] break-words text-on-surface-variant">{summary(entry.detail)}</Cell>
            <Cell className="text-on-surface-variant">{entry.ipAddress ?? "—"}</Cell>
          </tr>
        ))}
      </AdminTable>
      <NextPage base="/admin/activity" cursor={nextCursor} params={{ category }} />
    </div>
  );
}
