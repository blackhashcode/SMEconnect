import type { components } from "@/lib/backend/schema";
import type { ApiRole, Business, LoanRequestView, MeResponse, Person, Role, SessionUser } from "@/data/types";
import { formatBDT } from "@/lib/format";

/**
 * Turns API responses into the UI's display types. This is the only place that
 * knows how both sides are shaped, so the rest of the UI stays stable when the
 * API evolves.
 */

type S = components["schemas"];

export const toRole = (role: ApiRole): Role => (role === "OWNER" ? "business" : role === "INVESTOR" ? "investor" : "admin");

const place = (district?: string | null, city?: string | null) => [district, city].filter(Boolean).join(", ");
const firstSentence = (text?: string | null) => (text ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
const lendRange = (min: number, max: number) => `Lends ${formatBDT(min)}–${formatBDT(max)}`;

/** A member card/profile from a business directory entry. */
export function businessPerson(b: S["DiscoveryBusiness"]): Person {
  return {
    id: b.id,
    name: b.name,
    role: "business",
    headline: `${b.shopName} · ${b.category}`,
    location: place(b.district, b.city),
    avatar: b.image ?? "",
    cover: "",
    verified: b.verified,
    about: b.description ?? "",
    trustScore: b.trustScore,
  };
}

export function discoveryBusiness(b: S["DiscoveryBusiness"]): Business {
  return {
    id: b.id,
    ownerId: b.id,
    name: b.shopName,
    slug: b.slug,
    category: b.category,
    tagline: firstSentence(b.description),
    location: place(b.district, b.city),
    runningSince: null,
    ordersRange: null,
    salesMin: null,
    salesMax: null,
    image: b.logoUrl ?? b.image ?? "",
    logo: b.logoUrl ?? "",
    gallery: [],
    description: b.description ?? "",
    growthStory: "",
    verified: b.verified,
    trustScore: b.trustScore,
    links: [],
  };
}

export function investorPerson(i: S["DiscoveryInvestor"]): Person {
  return {
    id: i.id,
    name: i.name,
    role: "investor",
    headline: lendRange(i.minLendBdt, i.maxLendBdt),
    location: place(i.district, i.city),
    avatar: i.image ?? "",
    cover: "",
    verified: i.verified,
    about: i.bio ?? "",
    trustScore: i.trustScore,
  };
}

/** Public profile (GET /profiles/{userId}); the id comes from the route. */
export function profilePerson(id: string, p: S["PublicProfile"]): Person {
  const role = toRole(p.role);
  const profile = p.profile as Partial<S["PublicBusinessProfile"] & S["PublicInvestorProfile"]> | null;
  return {
    id,
    name: p.name,
    role,
    headline:
      role === "business"
        ? `${profile?.shopName ?? "Business"} · ${profile?.category ?? ""}`.replace(/ · $/, "")
        : profile?.minLendBdt !== undefined && profile?.maxLendBdt !== undefined
          ? lendRange(profile.minLendBdt, profile.maxLendBdt)
          : "Investor",
    location: place(profile?.district, profile?.city),
    avatar: p.image ?? "",
    cover: profile?.coverUrl ?? "",
    verified: p.verified,
    about: (role === "business" ? profile?.description : profile?.bio) ?? "",
    trustScore: profile?.trustScore ?? 0,
  };
}

export function profileBusiness(id: string, p: S["PublicProfile"]): Business | null {
  if (p.role !== "OWNER" || !p.profile) return null;
  const b = p.profile as S["PublicBusinessProfile"];
  const links = [
    ["Facebook", b.facebookUrl],
    ["Instagram", b.instagramUrl],
    ["WhatsApp", b.whatsappUrl],
    ["Website", b.websiteUrl],
  ]
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    .map(([label, href]) => ({ label, href }));
  return {
    id,
    ownerId: id,
    name: b.shopName,
    slug: b.slug,
    category: b.category,
    tagline: firstSentence(b.description),
    location: place(b.district, b.city),
    runningSince: b.runningSince ?? null,
    ordersRange: b.monthlyOrdersRange ?? null,
    salesMin: b.monthlySalesMinBdt ?? null,
    salesMax: b.monthlySalesMaxBdt ?? null,
    image: b.coverUrl ?? b.logoUrl ?? "",
    logo: b.logoUrl ?? "",
    gallery: (b.productImages ?? []).map((image) => image.url),
    description: b.description ?? "",
    growthStory: b.growthStory ?? "",
    verified: p.verified,
    trustScore: b.trustScore,
    links,
  };
}

/** Public loan request → card/detail view. */
export function loanRequestView(r: S["PublicLoanRequest"]): LoanRequestView {
  const o = r.owner;
  return {
    id: r.id,
    title: r.purpose,
    description: r.fundUsage,
    amount: r.amountBdt,
    tenureDays: r.tenureDays,
    frequency: r.repaymentFrequency,
    rate: r.proposedRatePct === null || r.proposedRatePct === undefined ? null : Number(r.proposedRatePct),
    status: "OPEN",
    createdAt: r.publishedAt ?? r.createdAt,
    owner: {
      id: o.id,
      name: o.name,
      role: "business",
      headline: `${o.shopName} · ${o.category}`,
      location: place(o.district, o.city),
      avatar: o.image ?? "",
      cover: "",
      verified: o.verified,
      about: "",
      trustScore: o.trustScore,
    },
    business: {
      id: o.id,
      name: o.shopName,
      slug: o.slug,
      category: o.category,
      location: place(o.district, o.city),
      image: o.logoUrl ?? o.image ?? "",
      logo: o.logoUrl ?? "",
      verified: o.verified,
      trustScore: o.trustScore,
    },
  };
}

/** The signed-in member from GET /me. */
export function sessionUser(me: MeResponse): SessionUser {
  const unread = (me.unread ?? {}) as { notifications?: number; messages?: number };
  return {
    id: me.user.id,
    name: me.user.name,
    email: me.user.email,
    role: toRole(me.user.role),
    avatar: me.user.image ?? "",
    phone: me.user.phone ?? null,
    hasProfile: me.profile !== null,
    verification: me.verification?.status ?? null,
    unread: { notifications: unread.notifications ?? 0, messages: unread.messages ?? 0 },
  };
}

/** A counterparty (offer party, chat participant) as a lightweight Person. */
export function partyPerson(p: S["OfferParty"] | S["MessageParticipant"]): Person {
  const role = toRole(p.role);
  return {
    id: p.id,
    name: p.name,
    role,
    headline: p.shopName ? `${p.shopName}${p.category ? ` · ${p.category}` : ""}` : role === "investor" ? "Investor" : "Member",
    location: "",
    avatar: p.image ?? "",
    cover: "",
    verified: p.verified,
    about: "",
    trustScore: 0,
  };
}
