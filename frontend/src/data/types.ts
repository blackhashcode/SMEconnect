export type Role = "business" | "investor" | "admin";

export type Person = {
  id: string;
  name: string;
  role: Role;
  headline: string;
  location: string;
  avatar: string;
  cover: string;
  verified: boolean;
  connections: number;
  about: string;
  joined: string;
  rating: number;
  completedLoans?: number;
  offersMade?: number;
  committed?: number;
  followers?: number;
};

export type Business = {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  tagline: string;
  location: string;
  founded: string;
  teamSize: string;
  monthlyRevenue: number;
  image: string;
  gallery: string[];
  description: string;
  verified: boolean;
  specialties: string[];
};

export type LoanStatus = "open" | "offers_received" | "agreed" | "closed";

export type LoanRequest = {
  id: string;
  businessId: string;
  title: string;
  amount: number;
  purpose: string;
  tenureMonths: number;
  rate: number;
  status: LoanStatus;
  createdAt: string;
  offersCount: number;
  connectionsCount: number;
  progress: number;
  description: string;
  repaymentFrequency: string;
  image: string;
  highlights: string[];
};

export type OfferStatus = "pending" | "negotiating" | "accepted" | "declined" | "withdrawn";

export type LoanOffer = {
  id: string;
  requestId: string;
  investorId: string;
  amount: number;
  rate: number;
  tenureMonths: number;
  frequency: string;
  status: OfferStatus;
  note: string;
  createdAt: string;
  /** Terms proposed back by the business owner while negotiating. */
  counter?: { amount: number; rate: number; tenureMonths: number; note: string };
  /** Who acted last, so each side knows whose turn it is. */
  lastActionBy?: "investor" | "owner";
};

export type Connection = {
  id: string;
  personId: string;
  businessId?: string;
  note: string;
  createdAt: string;
  state: "connected" | "pending";
};

export type NotificationKind = "offer" | "connection" | "message" | "system";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  personId?: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  actionLabel?: string;
  href?: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  time: string;
  kind?: "text" | "offer";
  offerId?: string;
};

export type ChatThread = {
  id: string;
  personId: string;
  businessId?: string;
  subject: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
};

export type VerificationCase = {
  id: string;
  personId: string;
  businessName: string;
  type: "Business" | "Investor";
  submittedAt: string;
  nid: string;
  tradeLicense: string;
  documents: string[];
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
};

/** The signed-in member returned by the API: public profile plus private account fields. */
export type SessionUser = Person & { email: string; phone?: string; businessId?: string };

// ---------- API views ----------
// Shapes returned by the API (see docs/API.md). Related records are embedded so
// pages don't need follow-up requests. Timestamps are ISO 8601 strings.

export type LoanRequestView = LoanRequest & { business: Business; owner: Person };

export type LoanOfferView = LoanOffer & {
  investor: Person;
  request: Pick<LoanRequest, "id" | "title" | "amount" | "status"> & { business: Pick<Business, "id" | "name" | "category" | "ownerId"> };
};

export type AgreementView = {
  status: "draft" | "agreed";
  loan: LoanRequestView;
  offer: LoanOfferView;
};

export type ThreadView = {
  id: string;
  subject: string;
  other: Person;
  /** The other member's business, when they are a business owner. */
  business: Pick<Business, "id" | "name"> | null;
  loanRequestId: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};

export type MessageView = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  kind: "text" | "offer" | "system";
  offerId: string | null;
  createdAt: string;
};
