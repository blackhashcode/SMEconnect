import { cache } from "react";
import { redirect } from "next/navigation";
import { backendGet } from "@/lib/backend/server";
import { sessionUser } from "@/lib/backend/mappers";
import type { MeResponse, SessionUser } from "@/data/types";

/** The signed-in member for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const { data } = await backendGet<MeResponse>("/me");
  return data ? sessionUser(data) : null;
});

/** For pages that need a member: sends visitors to /login and back afterwards. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}
