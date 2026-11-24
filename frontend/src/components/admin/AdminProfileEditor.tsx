"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";

type Kind = "text" | "textarea" | "url" | "number" | "decimal" | "date" | "select" | "categories";
type FieldDef = { key: string; label: string; kind: Kind; required?: boolean; options?: string[]; hint?: string; wide?: boolean };

const CATEGORIES = ["Food", "Fashion", "Handicrafts", "Cosmetics", "Gadgets", "Home Décor", "Other"];
const ORDER_RANGES = ["Under 50 orders/month", "50–100 orders/month", "100–300 orders/month", "300–1,000 orders/month", "1,000+ orders/month"];

const OWNER_FIELDS: FieldDef[] = [
  { key: "shopName", label: "Shop name", kind: "text", required: true },
  { key: "slug", label: "Profile address (slug)", kind: "text", required: true, hint: "Lowercase letters, numbers and dashes" },
  { key: "category", label: "Category", kind: "select", required: true, options: CATEGORIES },
  { key: "monthlyOrdersRange", label: "Orders per month", kind: "select", options: ORDER_RANGES },
  { key: "district", label: "Area / district", kind: "text", required: true },
  { key: "city", label: "City", kind: "text", required: true },
  { key: "monthlySalesMinBdt", label: "Lowest monthly sales (৳)", kind: "number" },
  { key: "monthlySalesMaxBdt", label: "Highest monthly sales (৳)", kind: "number" },
  { key: "runningSince", label: "Running since", kind: "date" },
  { key: "facebookUrl", label: "Facebook", kind: "url" },
  { key: "instagramUrl", label: "Instagram", kind: "url" },
  { key: "whatsappUrl", label: "WhatsApp link", kind: "url" },
  { key: "websiteUrl", label: "Website", kind: "url" },
  { key: "description", label: "About the business", kind: "textarea", wide: true },
  { key: "growthStory", label: "Growth story", kind: "textarea", wide: true },
];

const INVESTOR_FIELDS: FieldDef[] = [
  { key: "minLendBdt", label: "Smallest offer (৳)", kind: "number", required: true },
  { key: "maxLendBdt", label: "Largest offer (৳)", kind: "number", required: true },
  { key: "preferredTenureDays", label: "Preferred tenure (days)", kind: "number" },
  { key: "preferredRatePctMin", label: "Preferred rate from (% p.a.)", kind: "decimal" },
  { key: "preferredRatePctMax", label: "Preferred rate to (% p.a.)", kind: "decimal" },
  { key: "district", label: "Area / district", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "preferredCategories", label: "Preferred categories", kind: "categories", wide: true },
  { key: "bio", label: "About", kind: "textarea", wide: true },
];

const INPUT = "w-full rounded-lg border bg-surface-container-lowest px-2 py-1.5 text-body-sm focus:border-primary focus:outline-none";
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v);

function toText(value: unknown, kind: Kind): string {
  if (value === null || value === undefined) return "";
  if (kind === "date") return String(value).slice(0, 10);
  return String(value);
}

/**
 * Admin edit of every detail of a member's profile, saved through the same
 * validation members' own edits use. Only changed fields are sent; required
 * fields are checked first; "Saved" only shows when something really saved.
 */
export function AdminProfileEditor({ userId, role, name, image, profile }: { userId: string; role: "OWNER" | "INVESTOR"; name: string; image: string | null; profile: Record<string, unknown> | null }) {
  const router = useRouter();
  const defs = role === "OWNER" ? OWNER_FIELDS : INVESTOR_FIELDS;
  const initial = useMemo(() => {
    const p = profile ?? {};
    return Object.fromEntries(defs.map((d) => [d.key, d.kind === "categories" ? ((p[d.key] as string[] | undefined) ?? []).join("|") : toText(p[d.key], d.kind)]));
  }, [defs, profile]);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(name);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function openEditor() {
    setValues(initial);
    setFullName(name);
    setRemovePhoto(false);
    setErrors({});
    setError(null);
    setSaved(null);
    setOpen(true);
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.name = "Enter a name.";
    if (!profile) return e;
    for (const d of defs) {
      const v = (values[d.key] ?? "").trim();
      const changed = values[d.key] !== initial[d.key];
      if (d.required && !v) e[d.key] = "Required.";
      else if (d.kind === "url" && v && !isUrl(v)) e[d.key] = "Use a full link starting with https://";
      else if (d.kind === "number" && v && !(Number(v) > 0 && Number.isInteger(Number(v)))) e[d.key] = "Enter a whole number.";
      else if (d.kind === "decimal" && v && !/^\d{1,2}(\.\d{1,2})?$/.test(v)) e[d.key] = "Enter a rate like 12 or 12.5.";
      else if ((d.kind === "number" || d.kind === "date" || d.kind === "decimal") && changed && !v && initial[d.key]) e[d.key] = "This can be changed but not cleared.";
      else if (d.key === "slug" && v && !/^[a-z0-9-]{3,80}$/.test(v)) e[d.key] = "Use 3+ lowercase letters, numbers or dashes.";
    }
    const pair = role === "OWNER" ? ["monthlySalesMinBdt", "monthlySalesMaxBdt"] : ["minLendBdt", "maxLendBdt"];
    const [lo, hi] = pair.map((k) => Number(values[k] || 0));
    if (lo && hi && lo > hi) e[pair[1]] = "Must be at least the lower amount.";
    return e;
  }

  async function save() {
    setError(null);
    setSaved(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return setError("Please fix the highlighted fields.");

    const patch: Record<string, unknown> = {};
    if (profile) {
      for (const d of defs) {
        if (values[d.key] === initial[d.key]) continue;
        const v = values[d.key].trim();
        if (d.kind === "number") patch[d.key] = Number(v);
        else if (d.kind === "url") patch[d.key] = v || null;
        else if (d.kind === "categories") patch[d.key] = v ? v.split("|") : [];
        else patch[d.key] = v; // text, textarea, select, date, decimal (clearing text saves it empty)
      }
    }
    const body: Record<string, unknown> = {};
    if (fullName.trim() !== name) body.name = fullName.trim();
    if (removePhoto && image) body.image = null;
    if (Object.keys(patch).length) body.profile = patch;
    if (!Object.keys(body).length) return setError("Nothing has changed yet.");

    setBusy(true);
    const result = await api.patch(`/admin/users/${userId}/profile`, body);
    setBusy(false);
    if (!result.ok) {
      const fieldErrors = Object.fromEntries(Object.entries(result.fields).map(([k, v]) => [k.replace(/^profile\./, ""), v?.[0] ?? "Invalid value."]));
      setErrors(fieldErrors);
      return setError(result.error);
    }
    const count = Object.keys(patch).length + (body.name ? 1 : 0) + (body.image === null ? 1 : 0);
    setSaved(`Saved ${count} change${count === 1 ? "" : "s"}.`);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-space-sm">
        <Button variant="ghost" size="sm" onClick={openEditor}><Pencil className="h-4 w-4" aria-hidden /> Edit profile</Button>
        {saved && <span role="status" className="text-body-sm text-success">{saved}</span>}
      </span>
    );
  }

  const field = (d: FieldDef) => {
    const id = `admin-edit-${d.key}`;
    const err = errors[d.key];
    const border = err ? "border-error" : "border-outline-variant";
    const set = (v: string) => setValues((s) => ({ ...s, [d.key]: v }));
    let control: React.ReactNode;
    if (d.kind === "textarea") control = <textarea id={id} rows={3} value={values[d.key]} onChange={(e) => set(e.target.value)} className={cn(INPUT, border)} aria-invalid={Boolean(err) || undefined} />;
    else if (d.kind === "select")
      control = (
        <select id={id} value={values[d.key]} onChange={(e) => set(e.target.value)} className={cn(INPUT, border, "h-9")} aria-invalid={Boolean(err) || undefined}>
          {!d.required && <option value="">Not set</option>}
          {[...new Set([...(d.options ?? []), ...(values[d.key] ? [values[d.key]] : [])])].map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    else if (d.kind === "categories") {
      const selected = values[d.key] ? values[d.key].split("|") : [];
      control = (
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = selected.includes(c);
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => set((on ? selected.filter((x) => x !== c) : [...selected, c]).join("|"))} className={cn("rounded-full border px-2.5 py-1 text-label-sm", on ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant")}>
                {c}
              </button>
            );
          })}
        </div>
      );
    } else
      control = (
        <input
          id={id}
          type={d.kind === "number" ? "number" : d.kind === "date" ? "date" : d.kind === "url" ? "url" : "text"}
          inputMode={d.kind === "decimal" ? "decimal" : undefined}
          value={values[d.key]}
          onChange={(e) => set(e.target.value)}
          placeholder={d.kind === "url" ? "https://" : undefined}
          className={cn(INPUT, border)}
          aria-invalid={Boolean(err) || undefined}
        />
      );
    return (
      <div key={d.key} className={d.wide ? "sm:col-span-2" : undefined}>
        <label htmlFor={id} className="mb-0.5 block text-label-sm font-semibold text-on-surface-variant">
          {d.label}{d.required ? " *" : ""}
        </label>
        {control}
        {err ? <p className="mt-0.5 text-label-sm text-error">{err}</p> : d.hint ? <p className="mt-0.5 text-label-sm text-outline">{d.hint}</p> : null}
      </div>
    );
  };

  return (
    <div className="w-full space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-low p-space-md">
      <p className="text-label-md font-bold text-on-surface">Edit {name}&apos;s profile</p>
      <div className="grid gap-space-sm sm:grid-cols-2">
        <div>
          <label htmlFor="admin-edit-name" className="mb-0.5 block text-label-sm font-semibold text-on-surface-variant">Full name *</label>
          <input id="admin-edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={cn(INPUT, errors.name ? "border-error" : "border-outline-variant")} />
          {errors.name && <p className="mt-0.5 text-label-sm text-error">{errors.name}</p>}
        </div>
        {image && (
          <label className="flex items-end gap-2 pb-2 text-body-sm text-on-surface">
            <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} className="h-4 w-4 accent-primary" /> Remove profile photo
          </label>
        )}
      </div>
      {profile ? (
        <div className="grid gap-space-sm sm:grid-cols-2">{defs.map(field)}</div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">This member hasn&apos;t created a profile yet, so only the name and photo can be changed.</p>
      )}
      {error && <p role="alert" className="text-body-sm font-semibold text-error">{error}</p>}
      <div className="flex gap-space-sm">
        <Button size="sm" variant="secondary" onClick={save} disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save changes</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
