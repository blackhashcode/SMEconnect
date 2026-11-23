export function formatBDT(value: number) {
  return `৳${value.toLocaleString("en-IN")}`;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Mon", "12 Oct". */
export function timeAgo(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(then).toLocaleDateString("en-GB", { weekday: "short" });
  return new Date(then).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Clock time for chat bubbles, e.g. "10:42". */
export function clockTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Exact flat-rate repayment calculation aligned with `backend/AGENTS.md` §6:
 * total = principal + round(principal * rate% * (tenureDays / 365))
 * Final installment absorbs rounding remainder so sum(installments) === total.
 */
export function repaymentPlan(amount: number, rate: number, tenureMonths: number, frequency: string) {
  if (amount <= 0 || tenureMonths <= 0) {
    return { total: 0, cycles: 0, installment: 0, finalInstallment: 0 };
  }
  const tenureDays = Math.round(tenureMonths * 30);
  const interest = Math.round(amount * (rate / 100) * (tenureDays / 365));
  const total = amount + interest;
  const intervalDays = frequency === "Weekly" ? 7 : frequency === "Bi-weekly" ? 14 : 30;
  const cycles = Math.max(1, Math.round(tenureDays / intervalDays));
  const installment = Math.floor(total / cycles);
  const remainder = total - installment * cycles;
  return { total, cycles, installment, finalInstallment: installment + remainder };
}
