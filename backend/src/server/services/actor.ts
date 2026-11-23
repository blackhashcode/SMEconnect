import type { Role } from "@/server/auth/roles";

export interface Actor {
  id: string;
  role: Role;
}
