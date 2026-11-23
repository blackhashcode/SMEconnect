import type { Role } from "@/server/auth/roles";
import { ForbiddenError } from "@/server/errors";

export type VerificationType = "OWNER" | "INVESTOR";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Actor {
  id: string;
  role?: Role;
}

/** Server-side role check shared by route guards and services. */
export function assertRole(actor: Actor, ...allowed: Role[]): void {
  if (!actor.role || !allowed.includes(actor.role)) {
    throw new ForbiddenError(`Requires one of: ${allowed.join(", ")}`);
  }
}

/**
 * Ownership check shared by route guards and services. Admin bypass is opt-in
 * and must be granted explicitly by the endpoint that calls this helper.
 */
export function assertOwnership(
  resourceOwnerId: string,
  actor: Actor,
  options: { allowAdmin?: boolean } = {},
): void {
  if (resourceOwnerId === actor.id) return;
  if (options.allowAdmin && actor.role === "ADMIN") return;
  throw new ForbiddenError("You do not own this resource");
}

/** Owners and investors have matching verification types; admins have none. */
export function verificationTypeForRole(role: Role | undefined): VerificationType {
  if (role === "OWNER" || role === "INVESTOR") return role;
  throw new ForbiddenError("Only owners and investors can be verified");
}

/** Gate for actions that are only available after KYC approval. */
export function assertVerified(
  actor: Actor,
  status: VerificationStatus | null | undefined,
): void {
  const type = verificationTypeForRole(actor.role);
  if (status !== "APPROVED") {
    throw new ForbiddenError(`Requires an approved ${type.toLowerCase()} verification`);
  }
}
