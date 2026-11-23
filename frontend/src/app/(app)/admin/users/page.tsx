import Link from "next/link";
import { Search } from "lucide-react";
import { AdminTable, Cell, FilterChips, NextPage, StatusBadge, dateTime } from "@/components/admin/AdminTable";
import { adminUsers } from "@/lib/admin";

export const metadata = { title: "Members · Admin" };

type Params = { q?: string; role?: string; status?: string; cursor?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { items, nextCursor } = await adminUsers(params);
  const keep = { q: params.q, role: params.role, status: params.status };

  return (
    <div className="space-y-space-md">
      <form action="/admin/users" className="flex flex-wrap items-center gap-space-sm">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
          <input name="q" defaultValue={params.q} placeholder="Search by name or email" className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-space-md text-body-md text-on-surface focus:border-primary focus:outline-none" />
        </label>
        {params.role && <input type="hidden" name="role" value={params.role} />}
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button className="h-11 rounded-xl bg-primary px-space-lg text-label-md font-semibold text-on-primary">Search</button>
      </form>
      <div className="flex flex-wrap gap-space-lg">
        <FilterChips base="/admin/users" param="role" current={params.role} extra={{ q: params.q, status: params.status }} options={[{ value: "OWNER", label: "Owners" }, { value: "INVESTOR", label: "Investors" }, { value: "ADMIN", label: "Admins" }]} />
        <FilterChips base="/admin/users" param="status" current={params.status} extra={{ q: params.q, role: params.role }} options={[{ value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }]} />
      </div>

      <AdminTable head={["Member", "Role", "Account", "Verification", "Trust", "Joined"]} empty={items.length === 0}>
        {items.map((user) => (
          <tr key={user.id} className="hover:bg-surface-container-low">
            <Cell>
              <Link href={`/admin/users/${user.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">{user.name}</Link>
              <p className="text-on-surface-variant">{user.email}</p>
            </Cell>
            <Cell>{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</Cell>
            <Cell><StatusBadge status={user.status} /></Cell>
            <Cell><StatusBadge status={user.verificationStatus} /></Cell>
            <Cell>{user.trustScore}</Cell>
            <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(user.createdAt)}</Cell>
          </tr>
        ))}
      </AdminTable>
      <NextPage base="/admin/users" cursor={nextCursor} params={keep} />
    </div>
  );
}
