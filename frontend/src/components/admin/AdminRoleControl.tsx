"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, ShieldPlus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";

type Role = "OWNER" | "INVESTOR" | "ADMIN";
const LABEL: Record<Role, string> = { OWNER: "Business owner", INVESTOR: "Investor", ADMIN: "Admin" };

/** Change a member's role, including granting or removing admin access. */
export function AdminRoleControl({ userId, name, role }: { userId: string; name: string; role: Role }) {
  const router = useRouter();
  const [next, setNext] = useState<Role>(role === "ADMIN" ? "INVESTOR" : "ADMIN");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    const result = await api.patch(`/admin/users/${userId}/role`, { role: next });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <span className="inline-flex gap-space-sm">
        {role !== "ADMIN" && (
          <Button variant="secondary" size="sm" onClick={() => { setNext("ADMIN"); setOpen(true); }}>
            <ShieldPlus className="h-4 w-4" aria-hidden /> Make admin
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => { setNext(role === "OWNER" ? "INVESTOR" : "OWNER"); setOpen(true); }}>
          <UserCog className="h-4 w-4" aria-hidden /> Change role
        </Button>
      </span>
    );
  }

  return (
    <div className="w-full space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-sm sm:w-96">
      <label className="block text-body-sm text-on-surface">
        Change {name}&apos;s role from <strong>{LABEL[role]}</strong> to
        <select value={next} onChange={(e) => setNext(e.target.value as Role)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-body-sm">
          {(["OWNER", "INVESTOR", "ADMIN"] as Role[]).filter((r) => r !== role).map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
        </select>
      </label>
      <p className="text-body-sm text-on-surface-variant">
        {next === "ADMIN"
          ? "Admins can see every member's documents, suspend accounts, edit records and override workflows. Every action they take is logged."
          : "Their existing profile, requests and offers stay on record. They may need to complete a new profile for this role."}
      </p>
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-space-sm">
        <Button size="sm" variant="secondary" onClick={apply} disabled={busy}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
