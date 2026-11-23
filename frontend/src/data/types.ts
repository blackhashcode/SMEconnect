import type { components } from "@/lib/backend/schema";

/**
 * Types shared across the UI.
 *
 * Display types (Person, Business, LoanRequestView) are UI-friendly shapes built
 * from API responses in src/lib/backend/mappers.ts. Deal-flow types are the API's
 * own generated types (src/lib/backend/schema.d.ts, regenerate with
 * `npm run api:types`), so the compiler flags any contract change.
 */

type Schemas = components["schemas"];

export type Role = "business" | "investor" | "admin";
export type ApiRole = Schemas["Role"];

export type Person = {
  id: string;
  name: string;
  role: Role;
  headline: string;
  location: string;
  avatar: string;
  cover: string;
  verified: boolean;
  about: string;
  trustScore: number;
};

export type Business = {
  /** Owner's user id: business pages and profiles are keyed by the owner. */
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  category: string;
  tagline: string;
  location: string;
  runningSince: string | null;
  ordersRange: string | null;
  salesMin: number | null;
  salesMax: number | null;
  image: string;
  logo: string;
  gallery: string[];
  description: string;
  growthStory: string;
  verified: boolean;
  trustScore: number;
  links: { label: string; href: string }[];
};

export type LoanRequestStatus = Schemas["LoanRequestStatus"];
export type RepaymentFrequency = Schemas["RepaymentFrequency"];

/** A loan request as shown on cards and detail pages. */
export type LoanRequestView = {
  id: string;
  title: string;
  description: string;
  amount: number;
  tenureDays: number;
  frequency: RepaymentFrequency;
  rate: number | null;
  status: LoanRequestStatus;
  createdAt: string;
  owner: Person;
  business: Pick<Business, "id" | "name" | "slug" | "category" | "location" | "image" | "logo" | "verified" | "trustScore">;
};

export type VerificationStatus = Schemas["VerificationStatus"];

/** The signed-in member, from GET /api/v1/me. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  phone: string | null;
  /** Owner/investor profile completed (required before publishing or offering). */
  hasProfile: boolean;
  /** Identity verification state; null until documents are submitted. */
  verification: VerificationStatus | null;
  unread: { notifications: number; messages: number };
};

// ---------- API types used directly by deal-flow screens ----------
export type MeResponse = Schemas["MeResponse"];
export type OwnLoanRequest = Schemas["LoanRequestRecord"];
export type Offer = Schemas["OfferRecord"];
export type OfferStatus = Schemas["OfferStatus"];
export type LoanDetail = Schemas["LoanDetail"];
export type Agreement = Schemas["AgreementSummary"];
export type Repayment = Schemas["RepaymentRecord"];
export type Conversation = Schemas["ConversationRecord"];
export type Message = Schemas["MessageRecord"];
export type AppNotification = Schemas["NotificationRecord"];
export type OwnerDashboard = Schemas["OwnerDashboard"];
export type InvestorDashboard = Schemas["InvestorDashboard"];
export type Verification = Schemas["VerificationRecord"];
export type AdminVerification = Schemas["AdminVerificationRecord"];
export type UploadedFile = Schemas["UploadedFile"];
