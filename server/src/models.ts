import type { Business, Person, Role, SessionUser } from "../../src/data/types.ts";

export type { SessionUser };
import { get } from "./db.ts";

/** Row shapes as stored in SQLite (snake_case, 0/1 booleans, JSON text columns). */
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

/** An investor's activity, computed from their offers so profile numbers always match. */
function investorStats(userId: string) {
  const row = get<{ made: number; committed: number | null }>(
    `SELECT COUNT(*) AS made, SUM(CASE WHEN status = 'accepted' THEN amount END) AS committed
     FROM loan_offers WHERE investor_id = ? AND status != 'withdrawn'`,
    [userId],
  );
  return { offersMade: row?.made ?? 0, committed: row?.committed ?? 0 };
}

/** Public profile: never includes email, phone or password hash. */
export function toPerson(row: UserRow): Person {
  const stats = row.role === "investor" ? investorStats(row.id) : null;
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
