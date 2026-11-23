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
  return { person: profilePerson(userId, data), business: profileBusiness(userId, data), investor };
}

/** Landing page: a few open requests, cached for a minute, no session. */
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
