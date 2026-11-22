export const ROLES = ["OWNER", "INVESTOR", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];
