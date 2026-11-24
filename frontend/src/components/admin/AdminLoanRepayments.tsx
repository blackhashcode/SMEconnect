"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { AdminAction } from "@/components/admin/AdminAction";
import { StatusBadge } from "@/components/admin/AdminTable";
import { api } from "@/lib/client-api";
import { formatBDT, shortDate } from "@/lib/format";

type Instalment = { id: string; installmentNo: number; dueDate: string; amountBdt: number; status: string; markedPaidAt: string | null; confirmedAt: string | null; note: string | null };

/** Expandable instalment list for one loan, with the admin confirm override. */
export function AdminLoanRepayments({ loanId }: { loanId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Instalment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const result = await api.get<Instalment[]>(`/admin/loans/${loanId}/repayments`);
    if (result.ok) setRows(result.data);
    else setError(result.error);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      const result = await api.get<Instalment[]>(`/admin/loans/${loanId}/repayments`);
      if (result.ok) setRows(result.data);
      else setError(result.error);
    }
  }

  return (
    <div>
      <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline">
        Instalments <ChevronDown className={open ? "h-4 w-4 rotate-180 transition-transform" : "h-4 w-4 transition-transform"} aria-hidden />
      </button>
      {open && (
        <div className="mt-space-sm space-y-space-sm">
          {error && <p className="text-body-sm text-error">{error}</p>}
          {rows === null && !error && <LoaderCircle className="h-4 w-4 animate-spin text-outline" aria-hidden />}
          {rows?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-sm">
              <span className="w-8 font-semibold">#{r.installmentNo}</span>
              <span className="w-24">{formatBDT(r.amountBdt)}</span>
              <span className="w-28 text-on-surface-variant">due {shortDate(r.dueDate)}</span>
              <StatusBadge status={r.status} />
              {r.status !== "CONFIRMED" && (
                <AdminAction
                  endpoint={`/admin/repayments/${r.id}/confirm`}
                  label="Confirm (override)"
                  confirm={`Confirm instalment #${r.installmentNo} on the investor's behalf?`}
                  reason="Why (e.g. payment proof checked)"
                  onDone={() => void load()}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
