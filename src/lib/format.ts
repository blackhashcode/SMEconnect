export function formatBDT(value: number) {
  return `৳${value.toLocaleString("en-IN")}`;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Mon", "12 Oct". */
export function timeAgo(iso: string, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso; // tolerate older free-text values
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

/** Flat-rate repayment estimate used across offer and agreement screens. */
export function repaymentPlan(amount: number, rate: number, tenureMonths: number, frequency: string) {
  const total = Math.round(amount * (1 + (rate / 100) * (tenureMonths / 12)));
  const perMonth = frequency === "Weekly" ? 52 / 12 : frequency === "Bi-weekly" ? 26 / 12 : 1;
  const cycles = Math.max(1, Math.round(tenureMonths * perMonth));
  return { total, cycles, installment: Math.round(total / cycles) };
}
