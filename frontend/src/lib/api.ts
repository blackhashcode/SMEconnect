import { backendGet, backendGetPublic } from "@/lib/backend/server";
import {
  businessPerson,
  discoveryBusiness,
  investorPerson,
  loanRequestView,
  profileBusiness,
  profilePerson,
} from "@/lib/backend/mappers";
import type { components } from "@/lib/backend/schema";
import type {
  AdminVerification,
  AppNotification,
  Conversation,
  InvestorDashboard,
  LoanDetail,
  Offer,
  OwnLoanRequest,
  OwnerDashboard,
  Verification,
} from "@/data/types";

/**
 * Data access for Server Components. Every function calls the backend as the
 * current visitor and returns UI-ready data (see mappers.ts for display types).
 */

type S = components["schemas"];
const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
};

// ---------- Discovery (public) ----------

export async function listBusinesses(params: { q?: string; category?: string; limit?: number } = {}) {
  const { data } = await backendGet<S["DiscoveryBusiness"][]>(`/businesses${qs({ limit: 50, ...params })}`);
  return (data ?? []).map((b) => ({ business: discoveryBusiness(b), owner: businessPerson(b) }));
}

export async function listInvestors(params: { q?: string; category?: string; limit?: number } = {}) {
  const { data } = await backendGet<S["DiscoveryInvestor"][]>(`/investors${qs({ limit: 50, ...params })}`);
  return (data ?? []).map(investorPerson);
}

export async function listOpenLoanRequests(params: { q?: string; category?: string; limit?: number } = {}) {
  const { data } = await backendGet<S["PublicLoanRequest"][]>(`/loan-requests${qs({ limit: 50, ...params })}`);
  return (data ?? []).map(loanRequestView);
}

export async function getLoanRequest(id: string) {
  const { data } = await backendGet<S["PublicLoanRequest"]>(`/loan-requests/${encodeURIComponent(id)}`);
  return data ? loanRequestView(data) : null;
}

/** Public profile of any owner or investor, by user id. */
export async function getProfile(userId: string) {
  const { data } = await backendGet<S["PublicProfile"]>(`/profiles/${encodeURIComponent(userId)}`);
  if (!data) return null;
  const investor = data.role === "INVESTOR" ? (data.profile as S["PublicInvestorProfile"] | null) : null;
  return { person: profilePerson(userId, data), business: profileBusiness(userId, data), investor, role: data.role, hasProfile: data.profile !== null };
}

/** Landing page: a few open requests, cached for a minute, no session. */
/** Public lists cached for 30 s and shared between visitors (profile sidebars). */
export async function cachedOpenLoanRequests(limit = 50) {
  const data = await backendGetPublic<S["PublicLoanRequest"][]>(`/loan-requests?limit=${limit}`, 30);
  return (data ?? []).map(loanRequestView);
}

export async function cachedBusinesses(limit = 12) {
  const data = await backendGetPublic<S["DiscoveryBusiness"][]>(`/businesses?limit=${limit}`, 30);
  return (data ?? []).map((b) => ({ owner: businessPerson(b), business: discoveryBusiness(b) }));
}

export async function cachedInvestors(limit = 12) {
  const data = await backendGetPublic<S["DiscoveryInvestor"][]>(`/investors?limit=${limit}`, 30);
  return (data ?? []).map(investorPerson);
}

export async function featuredLoanRequests(limit = 3) {
  const data = await backendGetPublic<S["PublicLoanRequest"][]>(`/loan-requests?limit=${limit}`);
  return (data ?? []).map(loanRequestView);
}

// ---------- My account ----------

export async function myLoanRequests() {
  const { data } = await backendGet<OwnLoanRequest[]>("/me/loan-requests?limit=50");
  return data ?? [];
}

export async function myVerification() {
  const { data } = await backendGet<Verification | null>("/verifications/me");
  return data ?? null;
}

export async function ownerDashboard() {
  return (await backendGet<OwnerDashboard>("/dashboard/owner")).data;
}

export async function investorDashboard() {
  return (await backendGet<InvestorDashboard>("/dashboard/investor")).data;
}

// ---------- Offers, loans, agreements ----------

export async function offersReceived(loanRequestId?: string) {
  const { data } = await backendGet<Offer[]>(`/offers/received${qs({ loanRequestId, limit: 50 })}`);
  return data ?? [];
}

export async function offersSubmitted() {
  const { data } = await backendGet<Offer[]>("/offers/submitted?limit=50");
  return data ?? [];
}

export async function getOffer(id: string) {
  return (await backendGet<Offer>(`/offers/${encodeURIComponent(id)}`)).data;
}

export async function getLoan(id: string) {
  return (await backendGet<LoanDetail>(`/loans/${encodeURIComponent(id)}`)).data;
}

// ---------- Messages and notifications ----------

export async function listConversations() {
  const { data } = await backendGet<Conversation[]>("/conversations?limit=50");
  return data ?? [];
}

export async function listNotifications() {
  const { data } = await backendGet<AppNotification[]>("/notifications?limit=50");
  return data ?? [];
}

// ---------- Admin ----------

export async function verificationQueue(status: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  const { data } = await backendGet<AdminVerification[]>(`/admin/verifications${qs({ status, limit: 50 })}`);
  return data ?? [];
}

// ---------- Reputation ----------

export async function reviewsFor(userId: string) {
  const res = await backendGet<S["ReviewRecord"][]>(`/reviews?userId=${encodeURIComponent(userId)}&limit=5`);
  return res.data ?? [];
}

// ---------- Auth options ----------

/** Which sign-in methods the backend has configured (cached briefly; it rarely changes). */
export async function authOptions(): Promise<{ google: boolean }> {
  const data = await backendGetPublic<{ google: boolean }>("/auth-options", 300);
  return { google: data?.google === true };
}

// ---------- Connections ----------

export type ConnectionStatusResult = { userId: string; status: "none" | "outgoing" | "incoming" | "connected" | "declined" | "self"; connectionId: string | null; following: boolean; blockedByMe: boolean };

/** The viewer's connection status with one member (null for admins or logged-out visitors). */
export async function connectionStatus(userId: string): Promise<ConnectionStatusResult | null> {
  const { data } = await backendGet<ConnectionStatusResult>(`/connections/with/${encodeURIComponent(userId)}`);
  return data;
}

export type ConnectionItem = {
  id: string;
  userId: string;
  user: { name: string; image: string | null; role: "OWNER" | "INVESTOR"; verified: boolean; shopName: string | null };
  direction: "incoming" | "outgoing";
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  message: string | null;
  createdAt: string;
};

/** The viewer's connections and requests, newest first. */
export async function myConnections(status?: "PENDING" | "ACCEPTED", direction?: "incoming" | "outgoing") {
  const { data } = await backendGet<ConnectionItem[]>(`/connections${qs({ status, direction, limit: 50 })}`);
  return data ?? [];
}

// ---------- Feed ----------

export type FeedPost = S["PostRecord"];

/** Posts from people you follow or are connected with, your own, and open loan requests. */
export async function feedPosts(limit = 20) {
  const { data, meta } = await backendGet<FeedPost[]>(`/feed?limit=${limit}`);
  return { posts: data ?? [], nextCursor: meta?.nextCursor ?? null };
}

/** A member's own posts, newest first (for their profile). */
export async function postsBy(authorId: string, limit = 10) {
  const { data } = await backendGet<FeedPost[]>(`/posts${qs({ authorId, limit })}`);
  return data ?? [];
}

// ---------- Lending history ----------

export type LendingHistory = {
  userId: string;
  role: "OWNER" | "INVESTOR";
  summary: {
    loans: number;
    completed: number;
    active: number;
    defaulted: number;
    totalPrincipalBdt: number;
    instalmentsPaid: number;
    onTimeRatePct: number | null;
    overdueInstalments: number;
  };
  loans: {
    id: string;
    role: "borrowed" | "lent";
    counterparty: { id: string; name: string; role: "OWNER" | "INVESTOR" };
    principalBdt: number;
    interestRatePct: number;
    tenureDays: number;
    status: string;
    startDate: string | null;
    repayments: { total: number; paid: number; overdue: number };
  }[];
};

export async function lendingHistory(userId: string) {
  const { data } = await backendGet<LendingHistory>(`/profiles/${encodeURIComponent(userId)}/lending-history`);
  return data;
}
