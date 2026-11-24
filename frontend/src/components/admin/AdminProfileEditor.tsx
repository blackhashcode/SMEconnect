"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";

type Field = { key: string; label: string; type?: "text" | "number" | "textarea"; value: string };

const INPUT = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-body-sm focus:border-primary focus:outline-none";

/**
 * Admin edit of a member's name and main profile fields. Saved through the same
 * validation the member's own edits use; changes are recorded in the activity log.
 */
export function AdminProfileEditor({ userId, role, name, profile }: { userId: string; role: "OWNER" | "INVESTOR"; name: string; profile: Record<string, unknown> | null }) {
  const router = useRouter();
  const p = profile ?? {};
  const str = (k: string) => (p[k] === null || p[k] === undefined ? "" : String(p[k]));
  const initial: Field[] =
    role === "OWNER"
      ? [
          { key: "shopName", label: "Shop name", value: str("shopName") },
          { key: "category", label: "Category", value: str("category") },
          { key: "district", label: "Area / district", value: str("district") },
          { key: "city", label: "City", value: str("city") },
          { key: "monthlySalesMinBdt", label: "Lowest monthly sales (৳)", type: "number", value: str("monthlySalesMinBdt") },
          { key: "monthlySalesMaxBdt", label: "Highest monthly sales (৳)", type: "number", value: str("monthlySalesMaxBdt") },
          { key: "description", label: "About the business", type: "textarea", value: str("description") },
        ]
      : [
          { key: "minLendBdt", label: "Smallest offer (৳)", type: "number", value: str("minLendBdt") },
          { key: "maxLendBdt", label: "Largest offer (৳)", type: "number", value: str("maxLendBdt") },
          { key: "district", label: "Area / district", value: str("district") },
          { key: "city", label: "City", value: str("city") },
          { key: "bio", label: "About", type: "textarea", value: str("bio") },
        ];
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(name);
  const [fields, setFields] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const changed = fields.filter((f, i) => f.value !== initial[i].value);
    const profilePatch = Object.fromEntries(
      changed.map((f) => [f.key, f.type === "number" ? (f.value ? Number(f.value) : undefined) : f.value.trim() || undefined]),
    );
    const body: Record<string, unknown> = {};
    if (fullName.trim() && fullName.trim() !== name) body.name = fullName.trim();
    if (Object.keys(profilePatch).length) body.profile = profilePatch;
    if (!Object.keys(body).length) {
      setBusy(false);
      return setOpen(false);
    }
    const result = await api.patch(`/admin/users/${userId}/profile`, body);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSaved(true);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-space-sm">
        <Button variant="ghost" size="sm" onClick={() => { setOpen(true); setSaved(false); }}><Pencil className="h-4 w-4" aria-hidden /> Edit profile</Button>
        {saved && <span className="text-body-sm text-success">Saved</span>}
      </span>
    );
  }

  return (
    <div className="w-full space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-md">
      <p className="text-label-md font-bold text-on-surface">Edit {name}&apos;s profile</p>
      {!profile && <p className="text-body-sm text-on-surface-variant">This member hasn&apos;t created a profile yet, so only the name can be changed.</p>}
      <label className="block text-label-sm text-on-surface-variant">Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT} /></label>
      {profile && (
        <div className="grid gap-space-sm sm:grid-cols-2">
          {fields.map((f, i) => (
            <label key={f.key} className={f.type === "textarea" ? "block text-label-sm text-on-surface-variant sm:col-span-2" : "block text-label-sm text-on-surface-variant"}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea rows={3} value={f.value} onChange={(e) => setFields((list) => list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className={INPUT} />
              ) : (
                <input type={f.type ?? "text"} value={f.value} onChange={(e) => setFields((list) => list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className={INPUT} />
              )}
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <div className="flex gap-space-sm">
        <Button size="sm" variant="secondary" onClick={save} disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save changes</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
