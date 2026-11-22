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

export type OfferStatus = "pending" | "negotiating" | "accepted" | "declined";

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
