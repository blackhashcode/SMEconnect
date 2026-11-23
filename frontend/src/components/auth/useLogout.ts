"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ends the session on the API, then returns to the login page. */
export function useLogout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      // Even if the request failed, leave the member area; the guard re-checks.
      router.replace("/login?loggedOut=1");
      router.refresh();
    }
  }

  return { logout, pending };
}
