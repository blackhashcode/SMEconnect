import type { Business, Person, Role, SessionUser } from "../../src/data/types.ts";
import { all, get } from "./db.ts";

export type { SessionUser };

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  phone: string | null;
  headline: string;
  location: string;
  avatar: string;
  cover: string;
  about: string;
  verified: number;
  connections: number;
  rating: number;
  joined: string;
  completed_loans: number | null;
  offers_made: number | null;
  committed: number | null;
  followers: number | null;
};

export type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  tagline: string;
  location: string;
  founded: string;
  team_size: string;
  monthly_revenue: number;
  image: string;
  gallery: string;
  description: string;
  verified: number;
  specialties: string;
};

const optional = (value: number | null) => (value === null ? undefined : value);

type InvestorStat = { offersMade: number; committed: number };

/** Batched investor stats lookup to eliminate N+1 queries on directory & offer lists. */
export function batchInvestorStats(userIds: string[]): Map<string, InvestorStat> {
  const unique = [...new Set(userIds)];
  const map = new Map<string, InvestorStat>();
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => "?").join(", ");
  const rows = all<{ investor_id: string; made: number; committed: number | null }>(
    `SELECT investor_id, COUNT(*) AS made, SUM(CASE WHEN status = 'accepted' THEN amount END) AS committed
     FROM loan_offers
     WHERE investor_id IN (${placeholders}) AND status != 'withdrawn'
     GROUP BY investor_id`,
    unique,
  );
  for (const row of rows) {
    map.set(row.investor_id, { offersMade: row.made ?? 0, committed: row.committed ?? 0 });
  }
  return map;
}

function investorStatsSingle(userId: string): InvestorStat {
  const row = get<{ made: number; committed: number | null }>(
    `SELECT COUNT(*) AS made, SUM(CASE WHEN status = 'accepted' THEN amount END) AS committed
     FROM loan_offers WHERE investor_id = ? AND status != 'withdrawn'`,
    [userId],
  );
  return { offersMade: row?.made ?? 0, committed: row?.committed ?? 0 };
}

/** Public profile: never includes email, phone, or password hash. */
export function toPerson(row: UserRow, preloadedStats?: Map<string, InvestorStat>): Person {
  const stats =
    row.role === "investor"
      ? preloadedStats
        ? (preloadedStats.get(row.id) ?? { offersMade: 0, committed: 0 })
        : investorStatsSingle(row.id)
      : null;

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    headline: row.headline,
    location: row.location,
    avatar: row.avatar,
    cover: row.cover,
    verified: row.verified === 1,
    connections: row.connections,
    about: row.about,
    joined: row.joined,
    rating: row.rating,
    completedLoans: optional(row.completed_loans),
    offersMade: stats ? stats.offersMade : optional(row.offers_made),
    committed: stats ? stats.committed : optional(row.committed),
    followers: optional(row.followers),
  };
}

export function toPeople(rows: UserRow[]): Person[] {
  const investorIds = rows.filter((r) => r.role === "investor").map((r) => r.id);
  const stats = batchInvestorStats(investorIds);
  return rows.map((row) => toPerson(row, stats));
}

export function toSessionUser(row: UserRow, businessId?: string): SessionUser {
  return { ...toPerson(row), email: row.email, phone: row.phone ?? undefined, businessId };
}

function parseList(json: string): string[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function toBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    category: row.category,
    tagline: row.tagline,
    location: row.location,
    founded: row.founded,
    teamSize: row.team_size,
    monthlyRevenue: row.monthly_revenue,
    image: row.image,
    gallery: parseList(row.gallery),
    description: row.description,
    verified: row.verified === 1,
    specialties: parseList(row.specialties),
  };
}
