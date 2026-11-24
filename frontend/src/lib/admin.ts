import { backendGet } from "@/lib/backend/server";
import type { components } from "@/lib/backend/schema";

/** Server-side data access for the admin panel (ADMIN session required by the backend). */

type S = components["schemas"];
export type AdminStats = S["AdminStats"];
export type AdminUserRecord = S["AdminUserRecord"];
export type AdminUserDetail = S["AdminUserDetail"];
export type AdminReport = S["AdminReportListSuccessEnvelope"]["data"][number];
export type AdminReportDetail = S["AdminReportDetail"];
export type AdminPost = S["AdminPostRecord"];
export type AdminComment = S["AdminCommentRecord"];
export type Page<T> = { items: T[]; nextCursor: string | null };

export type AuditEntry = {
  id: string;
  action: string;
  actor: { id: string; name: string; email: string | null; role: string | null } | null;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AdminLoanRequest = {
  id: string;
  purpose: string;
  amountBdt: number;
  tenureDays: number;
  repaymentFrequency: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  offerCount: number;
  owner: { id: string; name: string; email: string; status: string; shopName: string | null; category: string | null };
};

export type AdminLoan = {
  id: string;
  principalBdt: number;
  interestRatePct: number;
  tenureDays: number;
  status: string;
  startDate: string | null;
  createdAt: string;
  owner: { id: string; name: string; shopName: string | null };
  investor: { id: string; name: string };
  repayments: { total: number; confirmed: number; overdue: number };
};

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

async function page<T>(path: string): Promise<Page<T>> {
  const res = await backendGet<T[]>(path);
  return { items: res.data ?? [], nextCursor: res.meta?.nextCursor ?? null };
}

export const adminStats = async () => (await backendGet<AdminStats>("/admin/stats")).data;

export const adminUsers = (params: { q?: string; role?: string; status?: string; cursor?: string }) =>
  page<AdminUserRecord>(`/admin/users${qs({ ...params, limit: 25 })}`);

export type VerificationSubmission = {
  id: string;
  verificationId: string;
  type: "OWNER" | "INVESTOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  idDocumentUrl: string;
  salesProofUrls: string[];
  shopLinks: string[];
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewer: { id: string; name: string } | null;
};

export const verificationHistory = async (userId: string) =>
  (await backendGet<VerificationSubmission[]>(`/admin/users/${encodeURIComponent(userId)}/verification-history`)).data ?? [];

export const adminUser = async (id: string) => (await backendGet<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`)).data;

export const auditLogs = (params: { category?: string; action?: string; actorId?: string; targetId?: string; cursor?: string; limit?: number }) =>
  page<AuditEntry>(`/admin/audit-logs${qs({ limit: 30, ...params })}`);

export const adminLoanRequests = (params: { status?: string; q?: string; cursor?: string }) =>
  page<AdminLoanRequest>(`/admin/loan-requests${qs({ ...params, limit: 25 })}`);

export const adminLoans = (params: { status?: string; cursor?: string }) => page<AdminLoan>(`/admin/loans${qs({ ...params, limit: 25 })}`);

export const adminReports = (params: { status?: string; cursor?: string }) => page<AdminReport>(`/admin/reports${qs({ ...params, limit: 25 })}`);

export const adminReport = async (id: string) => (await backendGet<AdminReportDetail>(`/admin/reports/${encodeURIComponent(id)}`)).data;

export const adminPosts = (cursor?: string) => page<AdminPost>(`/admin/posts${qs({ cursor, limit: 20 })}`);

export const adminComments = (cursor?: string) => page<AdminComment>(`/admin/comments${qs({ cursor, limit: 20 })}`);

/** Human wording for activity-log actions. */
export function describeAction(action: string): string {
  const labels: Record<string, string> = {
    "auth.sign_in": "Signed in",
    "account.created": "Created an account",
    "account.role_changed": "Changed account type",
    "verification.submitted": "Submitted verification documents",
    "loan_request.published": "Published a loan request",
    "offer.created": "Made an offer",
    "offer.accepted": "Accepted an offer",
    "offer.rejected": "Rejected an offer",
    "offer.countered": "Countered an offer",
    "offer.withdrawn": "Withdrew an offer",
    "agreement.confirmed": "Confirmed an agreement",
    "repayment.marked_paid": "Marked a repayment as paid",
    "repayment.confirmed": "Confirmed a repayment",
    "report.created": "Reported something",
    "admin.verification_reviewed": "Reviewed a verification",
    "admin.document_viewed": "Opened a private document",
    "admin.role_granted": "Granted admin access",
    "admin.role_changed": "Changed a member's role",
    "admin.profile_edited": "Edited a member's profile",
    "admin.post_restored": "Restored a post",
    "admin.comment_restored": "Restored a comment",
    "admin.repayment_confirmed": "Confirmed a repayment (override)",
    "admin.user_suspended": "Suspended a member",
    "admin.user_reactivated": "Reactivated a member",
    "admin.sessions_revoked": "Signed a member out everywhere",
    "admin.report_resolved": "Resolved a report",
    "admin.report_dismissed": "Dismissed a report",
    "admin.post_removed": "Removed a post",
    "admin.comment_removed": "Removed a comment",
    "admin.loan_request_paused": "Paused a loan request",
    "admin.loan_request_resumed": "Reopened a loan request",
    "admin.loan_request_cancelled": "Cancelled a loan request",
  };
  return labels[action] ?? action;
}

export const LOAN_REQUEST_STATUSES = ["DRAFT", "OPEN", "IN_DISCUSSION", "PAUSED", "FUNDED", "REPAYING", "COMPLETED", "CANCELLED"] as const;
export const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
