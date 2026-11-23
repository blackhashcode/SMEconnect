export function formatBDT(value: number) {
  return `৳${value.toLocaleString("en-IN")}`;
}

/** Short amounts for tight spaces: ৳850, ৳45k, ৳1.2 lakh, ৳3.5 cr (Bangladeshi units). */
export function formatBDTCompact(value: number) {
  const trim = (n: number) => (Math.round(n * 10) / 10).toString();
  if (value >= 10_000_000) return `৳${trim(value / 10_000_000)} cr`;
  if (value >= 100_000) return `৳${trim(value / 100_000)} lakh`;
  if (value >= 1_000) return `৳${trim(value / 1_000)}k`;
  return `৳${value}`;
}

/** Display name for buttons: the first name, skipping common prefixes like "Md." or "Mst.". */
export function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  const prefix = /^(md|mohd|mohammad|muhammad|mst|mrs?|ms|dr|engr)\.?$/i;
  return parts.find((part) => !prefix.test(part)) ?? parts[0] ?? "";
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

/**
 * Simple-interest estimate for previews while a member types terms. The backend
 * computes the binding schedule when an offer is accepted.
 */
export function repaymentEstimate(amount: number, ratePct: number, tenureDays: number, frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY") {
  const total = Math.round(amount * (1 + (ratePct / 100) * (tenureDays / 365)));
  const periodDays = frequency === "WEEKLY" ? 7 : frequency === "BIWEEKLY" ? 14 : 30;
  const instalments = Math.max(1, Math.ceil(tenureDays / periodDays));
  return { total, instalments, instalment: Math.round(total / instalments) };
}

/** "12 Mar 2026" */
export function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
