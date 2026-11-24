import Link from "next/link";
import { Ban, Pause, Play, RotateCcw, Search } from "lucide-react";
import { AdminLoanRepayments } from "@/components/admin/AdminLoanRepayments";
import { AdminAction } from "@/components/admin/AdminAction";
import { AdminTable, Cell, FilterChips, NextPage, StatusBadge, dateTime } from "@/components/admin/AdminTable";
import { LOAN_REQUEST_STATUSES, adminLoanRequests, adminLoans, statusLabel } from "@/lib/admin";
import { formatBDT } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";
import { cn } from "@/lib/cn";

export const metadata = { title: "Loans · Admin" };

type Params = { view?: string; status?: string; q?: string; cursor?: string };

export default async function AdminLoansPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const view = params.view === "loans" ? "loans" : "requests";

  return (
    <div className="space-y-space-md">
      <div className="flex gap-space-sm border-b border-surface-container-high">
        {[{ key: "requests", label: "Loan requests" }, { key: "loans", label: "Agreed loans" }].map((tab) => (
          <Link key={tab.key} href={tab.key === "loans" ? "/admin/loans?view=loans" : "/admin/loans"} className={cn("-mb-px border-b-2 px-space-md py-2 text-label-md font-semibold", view === tab.key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
            {tab.label}
          </Link>
        ))}
      </div>
      {view === "requests" ? <RequestsView params={params} /> : <LoansView params={params} />}
    </div>
  );
}

async function RequestsView({ params }: { params: Params }) {
  const { items, nextCursor } = await adminLoanRequests({ status: params.status, q: params.q, cursor: params.cursor });
  return (
    <>
      <form action="/admin/loans" className="flex flex-wrap gap-space-sm">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search loan requests</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden />
          <input name="q" defaultValue={params.q} placeholder="Search purpose, owner or shop" className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-space-md text-body-md focus:border-primary focus:outline-none" />
        </label>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button className="h-11 rounded-xl bg-primary px-space-lg text-label-md font-semibold text-on-primary">Search</button>
      </form>
      <FilterChips base="/admin/loans" param="status" current={params.status} extra={{ q: params.q }} options={LOAN_REQUEST_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} />
      <AdminTable head={["Request", "Owner", "Amount", "Status", "Offers", "Created", "Moderate"]} empty={items.length === 0}>
        {items.map((r) => (
          <tr key={r.id}>
            <Cell className="max-w-[260px]"><p className="font-semibold">{r.purpose}</p><p className="text-on-surface-variant">{tenureLabel(r.tenureDays)} · {r.repaymentFrequency.toLowerCase()}</p></Cell>
            <Cell><Link href={`/admin/users/${r.owner.id}`} className="font-semibold hover:underline">{r.owner.name}</Link><p className="text-on-surface-variant">{r.owner.shopName ?? "—"}</p></Cell>
            <Cell className="whitespace-nowrap">{formatBDT(r.amountBdt)}</Cell>
            <Cell><StatusBadge status={r.status} /></Cell>
            <Cell>{r.offerCount}</Cell>
            <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(r.createdAt)}</Cell>
            <Cell>
              <div className="flex flex-col items-start gap-space-sm">
                {["OPEN", "IN_DISCUSSION"].includes(r.status) && (
                  <AdminAction endpoint={`/admin/loan-requests/${r.id}/pause`} label="Pause" confirm="Pause this request? It's hidden from investors and the owner is told why." reason="Reason shown to the owner" icon={<Pause className="h-4 w-4" aria-hidden />} />
                )}
                {r.status === "PAUSED" && (
                  <AdminAction endpoint={`/admin/loan-requests/${r.id}/resume`} label="Reopen" variant="success" confirm="Reopen this request?" reason="Note to the owner" icon={<Play className="h-4 w-4" aria-hidden />} />
                )}
                {r.status === "CANCELLED" && (
                  <AdminAction endpoint={`/admin/loan-requests/${r.id}/reopen`} label="Reopen" variant="success" confirm="Reopen this cancelled request? It becomes visible to investors again." reason="Note to the owner" icon={<RotateCcw className="h-4 w-4" aria-hidden />} />
                )}
                {["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED"].includes(r.status) && (
                  <AdminAction endpoint={`/admin/loan-requests/${r.id}/cancel`} label="Cancel" variant="ghost" confirm="Cancel this request? Pending offers are withdrawn. This can't be undone." reason="Reason shown to the owner" icon={<Ban className="h-4 w-4" aria-hidden />} />
                )}
              </div>
            </Cell>
          </tr>
        ))}
      </AdminTable>
      <NextPage base="/admin/loans" cursor={nextCursor} params={{ status: params.status, q: params.q }} />
    </>
  );
}

async function LoansView({ params }: { params: Params }) {
  const { items, nextCursor } = await adminLoans({ status: params.status, cursor: params.cursor });
  return (
    <>
      <FilterChips base="/admin/loans" param="status" current={params.status} extra={{ view: "loans" }} options={["PENDING_AGREEMENT", "ACTIVE", "COMPLETED", "DEFAULTED"].map((s) => ({ value: s, label: statusLabel(s) }))} />
      <AdminTable head={["Loan", "Owner", "Investor", "Status", "Repayments", "Started", "Instalments"]} empty={items.length === 0}>
        {items.map((loan) => (
          <tr key={loan.id}>
            <Cell className="whitespace-nowrap"><p className="font-semibold">{formatBDT(loan.principalBdt)}</p><p className="text-on-surface-variant">{loan.interestRatePct}% · {tenureLabel(loan.tenureDays)}</p></Cell>
            <Cell><Link href={`/admin/users/${loan.owner.id}`} className="font-semibold hover:underline">{loan.owner.name}</Link><p className="text-on-surface-variant">{loan.owner.shopName ?? "—"}</p></Cell>
            <Cell><Link href={`/admin/users/${loan.investor.id}`} className="font-semibold hover:underline">{loan.investor.name}</Link></Cell>
            <Cell><StatusBadge status={loan.status} /></Cell>
            <Cell>
              {loan.repayments.confirmed}/{loan.repayments.total} confirmed
              {loan.repayments.overdue > 0 && <p className="font-semibold text-error">{loan.repayments.overdue} overdue</p>}
            </Cell>
            <Cell className="whitespace-nowrap text-on-surface-variant">{loan.startDate ? dateTime(loan.startDate) : "Not started"}</Cell>
            <Cell><AdminLoanRepayments loanId={loan.id} /></Cell>
          </tr>
        ))}
      </AdminTable>
      <NextPage base="/admin/loans" cursor={nextCursor} params={{ view: "loans", status: params.status }} />
    </>
  );
}
