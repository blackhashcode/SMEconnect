"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/data/types";

const SessionContext = createContext<SessionUser | null>(null);

/** Makes the signed-in member available to client components under the app layout. */
export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  return useContext(SessionContext);
}
