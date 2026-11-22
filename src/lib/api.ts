import { cookies } from "next/headers";
import type { AgreementView, Business, LoanOfferView, LoanRequestView, Person, ThreadView } from "@/data/types";

/**
 * Server-side client for the Express API (server/). Use only from Server
 * Components, layouts and route handlers: it forwards the visitor's cookies so
 * the API sees their session. The browser talks to the same API through the
 * `/api/*` rewrite in next.config.mjs.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Can't reach the SME Connect API at ${API_URL}. Is it running? (npm run dev:api)`, { cause });
  }
}

export async function apiGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const cookieHeader = (await cookies()).toString();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiUnavailableError(error);
  }
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as T };
}

export async function listBusinesses() {
  const { data } = await apiGet<{ businesses: Business[] }>("/businesses");
  return data?.businesses ?? [];
}

export async function listPeople(role?: Person["role"]) {
  const { data } = await apiGet<{ users: Person[] }>(role ? `/users?role=${role}` : "/users");
  return data?.users ?? [];
}

export async function getBusiness(id: string) {
  const { data } = await apiGet<{ business: Business; owner: Person | null }>(`/businesses/${encodeURIComponent(id)}`);
  return data;
}

export async function getPerson(id: string) {
  const { data } = await apiGet<{ user: Person; business: Business | null }>(`/users/${encodeURIComponent(id)}`);
  return data;
}

// ---------- Loans, offers, agreements ----------

export async function listLoans(params: { businessId?: string; status?: "active" | "open" | "offers_received" | "agreed" | "closed"; mine?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.businessId) search.set("businessId", params.businessId);
  if (params.status) search.set("status", params.status);
  if (params.mine) search.set("mine", "1");
  const qs = search.toString();
  const { data } = await apiGet<{ loans: LoanRequestView[] }>(`/loans${qs ? `?${qs}` : ""}`);
  return data?.loans ?? [];
}

export async function getLoan(id: string) {
  const { data } = await apiGet<{ loan: LoanRequestView }>(`/loans/${encodeURIComponent(id)}`);
  return data?.loan ?? null;
}

export async function listLoanOffers(loanId: string) {
  const { data } = await apiGet<{ offers: LoanOfferView[] }>(`/loans/${encodeURIComponent(loanId)}/offers`);
  return data?.offers ?? [];
}

export async function listMyOffers(role?: "sent" | "received") {
  const { data } = await apiGet<{ offers: LoanOfferView[] }>(`/offers${role ? `?role=${role}` : ""}`);
  return data?.offers ?? [];
}

export async function getOffer(id: string) {
  const { data } = await apiGet<{ offer: LoanOfferView; loan: LoanRequestView; viewerSide: "owner" | "investor" }>(`/offers/${encodeURIComponent(id)}`);
  return data;
}

export async function getAgreement(loanId: string) {
  const { data } = await apiGet<{ agreement: AgreementView }>(`/loans/${encodeURIComponent(loanId)}/agreement`);
  return data?.agreement ?? null;
}

// ---------- Messages ----------

export async function listThreads() {
  const { data } = await apiGet<{ threads: ThreadView[]; unread: number }>("/threads");
  return data ?? { threads: [], unread: 0 };
}

export async function unreadMessageCount() {
  const { data } = await apiGet<{ unread: number }>("/threads/unread-count");
  return data?.unread ?? 0;
}
