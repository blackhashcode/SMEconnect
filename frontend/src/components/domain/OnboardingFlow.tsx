"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCircle2, FileUp, Hourglass, ImageUp, LoaderCircle, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormAlert, FormField } from "@/components/auth/FormField";
import { api, fieldError, type FieldErrors } from "@/lib/client-api";
import { compressImage } from "@/lib/image-compress";
import { clearOnboardingDraft, readOnboardingDraft } from "@/lib/onboarding-draft";
import type { SessionUser, UploadedFile, Verification } from "@/data/types";

type BusinessProfile = { shopName: string; slug: string; category: string; district: string; city: string; description: string; facebookUrl: string };
type InvestorProfile = { minLendBdt: string; maxLendBdt: string; preferredCategories: string[]; district: string; city: string; bio: string };

const CATEGORIES = ["Food", "Fashion", "Handicrafts", "Cosmetics", "Gadgets", "Home Décor", "Other"];
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const blank = (value: string) => (value.trim() ? value.trim() : undefined);

async function uploadFile(file: File, purpose: "AVATAR" | "ID_DOCUMENT" | "SALES_PROOF") {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", await compressImage(file));
  return api.upload<UploadedFile>("/uploads", form);
}

/**
 * After email verification: complete the role-specific profile, then submit
 * identity documents for admin review. Both are required before publishing a
 * loan request (owners) or making offers (investors).
 */
export function OnboardingFlow({
  user,
  initialProfile,
  verification,
}: {
  user: SessionUser;
  initialProfile: Record<string, unknown> | null;
  verification: Verification | null;
}) {
  const router = useRouter();
  const isOwner = user.role === "business";
  const p = initialProfile ?? {};
  const [business, setBusiness] = useState<BusinessProfile>({
    shopName: String(p.shopName ?? ""),
    slug: String(p.slug ?? ""),
    category: String(p.category ?? CATEGORIES[0]),
    district: String(p.district ?? ""),
    city: String(p.city ?? ""),
    description: String(p.description ?? ""),
    facebookUrl: String(p.facebookUrl ?? ""),
  });
  const [investor, setInvestor] = useState<InvestorProfile>({
    minLendBdt: String(p.minLendBdt ?? "20000"),
    maxLendBdt: String(p.maxLendBdt ?? "100000"),
    preferredCategories: Array.isArray(p.preferredCategories) ? (p.preferredCategories as string[]) : [],
    district: String(p.district ?? ""),
    city: String(p.city ?? ""),
    bio: String(p.bio ?? ""),
  });

  // Pre-fill from what was typed at sign-up (same tab only).
  useEffect(() => {
    if (initialProfile) return;
    const draft = readOnboardingDraft();
    if (isOwner && draft.businessName) {
      setBusiness((current) => ({ ...current, shopName: draft.businessName ?? "", slug: slugify(draft.businessName ?? ""), category: CATEGORIES.includes(draft.category ?? "") ? draft.category! : current.category, city: draft.city ?? "" }));
    } else if (draft.city) {
      setInvestor((current) => ({ ...current, city: draft.city ?? "" }));
    }
  }, [initialProfile, isOwner]);

  const [profileSaved, setProfileSaved] = useState(user.hasProfile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    setFields({});
    const profile = isOwner
      ? {
          shopName: business.shopName.trim(),
          slug: business.slug.trim() || slugify(business.shopName),
          category: business.category,
          district: business.district.trim(),
          city: business.city.trim(),
          description: blank(business.description),
          facebookUrl: blank(business.facebookUrl),
        }
      : {
          minLendBdt: Number(investor.minLendBdt),
          maxLendBdt: Number(investor.maxLendBdt),
          preferredCategories: investor.preferredCategories,
          district: blank(investor.district),
          city: blank(investor.city),
          bio: blank(investor.bio),
        };
    const result = await api.patch("/me", { profile });
    setSavingProfile(false);
    if (!result.ok) {
      // Profile field errors are nested under "profile" by the API.
      const nested = Object.fromEntries(Object.entries(result.fields).map(([key, value]) => [key.replace(/^profile\./, ""), value]));
      setFields(nested);
      setProfileError(result.code === "VALIDATION_ERROR" ? "Please fix the highlighted fields." : result.error);
      return;
    }
    clearOnboardingDraft();
    setProfileSaved(true);
    router.refresh();
  }

  // ---------- Avatar ----------
  const [avatar, setAvatar] = useState(user.avatar);
  const [avatarBusy, setAvatarBusy] = useState(false);
  async function changeAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarBusy(true);
    const uploaded = await uploadFile(file, "AVATAR");
    if (uploaded.ok) {
      const saved = await api.patch("/me", { image: uploaded.data.url });
      if (saved.ok) setAvatar(uploaded.data.url);
    }
    setAvatarBusy(false);
    router.refresh();
  }

  // ---------- Verification ----------
  const [idDoc, setIdDoc] = useState<UploadedFile | null>(null);
  const [salesProofs, setSalesProofs] = useState<UploadedFile[]>([]);
  const [shopLink, setShopLink] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Verification | null>(null);
  const status = submitted?.status ?? verification?.status ?? null;
  const canSubmit = status === null || status === "REJECTED";

  async function addDocument(file: File | undefined, purpose: "ID_DOCUMENT" | "SALES_PROOF") {
    if (!file) return;
    setUploading(purpose);
    setVerifyError(null);
    const result = await uploadFile(file, purpose);
    setUploading(null);
    if (!result.ok) {
      setVerifyError(result.error);
      return;
    }
    if (purpose === "ID_DOCUMENT") setIdDoc(result.data);
    else setSalesProofs((current) => [...current, result.data].slice(0, 10));
  }

  async function submitVerification() {
    if (!idDoc) return setVerifyError("Upload a photo or PDF of your NID first.");
    if (isOwner && salesProofs.length === 0) return setVerifyError("Add at least one sales proof (e.g. a bKash or bank statement).");
    setUploading("submit");
    setVerifyError(null);
    const result = await api.post<Verification>("/verifications", {
      type: isOwner ? "OWNER" : "INVESTOR",
      idDocumentUrl: idDoc.url,
      salesProofUrls: salesProofs.map((file) => file.url),
      shopLinks: shopLink.trim() ? [shopLink.trim()] : [],
    });
    setUploading(null);
    if (!result.ok) {
      setVerifyError(result.error);
      return;
    }
    setSubmitted(result.data);
    router.refresh();
  }

  const fileInput = (label: string, purpose: "ID_DOCUMENT" | "SALES_PROOF", done: boolean) => (
    <label className={`flex cursor-pointer items-center gap-space-sm rounded-xl border border-dashed px-space-md py-3 text-body-sm transition-colors ${done ? "border-success bg-success-container/40 text-success" : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"}`}>
      {uploading === purpose ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
      <span className="flex-1">{label}</span>
      <span className="text-label-sm text-outline">JPG, PNG, WebP or PDF · 5 MB</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => addDocument(event.target.files?.[0], purpose)} disabled={uploading !== null} />
    </label>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-space-lg">
      <div>
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Getting started</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Set up your {isOwner ? "business" : "investor"} profile</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          {isOwner ? "Investors see this when they look at your loan requests." : "Business owners see this when you make an offer."} Verification keeps the network trustworthy.
        </p>
      </div>

      {/* Step 1: profile */}
      <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
        <div className="flex items-center justify-between gap-space-md">
          <h2 className="text-headline-sm text-on-surface">1. {isOwner ? "Business details" : "Lending preferences"}</h2>
          {profileSaved && <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Saved</Badge>}
        </div>
        {profileError && <div className="mt-space-md"><FormAlert>{profileError}</FormAlert></div>}
        <div className="mt-space-md flex items-center gap-space-md">
          <Avatar src={avatar} alt={user.name} name={user.name} size="lg" />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-2 text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed">
            {avatarBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <ImageUp className="h-4 w-4" aria-hidden />} {avatar ? "Change photo" : "Add a photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => changeAvatar(event.target.files?.[0])} disabled={avatarBusy} />
          </label>
        </div>
        {isOwner ? (
          <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
            <FormField label="Shop name" value={business.shopName} maxLength={200} onChange={(e) => setBusiness({ ...business, shopName: e.target.value, slug: profileSaved ? business.slug : slugify(e.target.value) })} error={fieldError(fields, "shopName")} />
            <FormField label="Profile address" hint={`smeconnect/${business.slug || "your-shop"}`} value={business.slug} maxLength={60} onChange={(e) => setBusiness({ ...business, slug: slugify(e.target.value) })} error={fieldError(fields, "slug")} />
            <label className="block">
              <span className="mb-1.5 block text-label-md font-semibold text-on-surface">Category</span>
              <select value={business.category} onChange={(e) => setBusiness({ ...business, category: e.target.value })} className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md text-body-md text-on-surface focus:border-primary focus:outline-none">
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <FormField label="Facebook page (optional)" placeholder="https://facebook.com/yourshop" value={business.facebookUrl} onChange={(e) => setBusiness({ ...business, facebookUrl: e.target.value })} error={fieldError(fields, "facebookUrl")} />
            <FormField label="Area / district" placeholder="e.g. Dhanmondi" value={business.district} maxLength={200} onChange={(e) => setBusiness({ ...business, district: e.target.value })} error={fieldError(fields, "district")} />
            <FormField label="City" placeholder="e.g. Dhaka" value={business.city} maxLength={200} onChange={(e) => setBusiness({ ...business, city: e.target.value })} error={fieldError(fields, "city")} />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-label-md font-semibold text-on-surface">About your business (optional)</span>
              <textarea rows={3} maxLength={5000} value={business.description} onChange={(e) => setBusiness({ ...business, description: e.target.value })} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
            </label>
          </div>
        ) : (
          <div className="mt-space-md grid gap-space-md sm:grid-cols-2">
            <FormField label="Smallest offer (৳)" type="number" value={investor.minLendBdt} onChange={(e) => setInvestor({ ...investor, minLendBdt: e.target.value })} error={fieldError(fields, "minLendBdt")} />
            <FormField label="Largest offer (৳)" type="number" value={investor.maxLendBdt} onChange={(e) => setInvestor({ ...investor, maxLendBdt: e.target.value })} error={fieldError(fields, "maxLendBdt")} />
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-label-md font-semibold text-on-surface">Categories you like (optional)</span>
              <div className="flex flex-wrap gap-space-sm">
                {CATEGORIES.map((category) => {
                  const on = investor.preferredCategories.includes(category);
                  return (
                    <button key={category} type="button" aria-pressed={on} onClick={() => setInvestor({ ...investor, preferredCategories: on ? investor.preferredCategories.filter((c) => c !== category) : [...investor.preferredCategories, category] })} className={`rounded-full border px-space-md py-1.5 text-label-md transition-all active:scale-95 ${on ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary"}`}>
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
            <FormField label="Area / district (optional)" value={investor.district} onChange={(e) => setInvestor({ ...investor, district: e.target.value })} />
            <FormField label="City (optional)" value={investor.city} onChange={(e) => setInvestor({ ...investor, city: e.target.value })} />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-label-md font-semibold text-on-surface">About you (optional)</span>
              <textarea rows={3} maxLength={5000} value={investor.bio} onChange={(e) => setInvestor({ ...investor, bio: e.target.value })} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface focus:border-primary focus:outline-none" />
            </label>
          </div>
        )}
        <div className="mt-space-md flex justify-end">
          <Button variant="secondary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} {profileSaved ? "Save changes" : "Save profile"}
          </Button>
        </div>
      </section>

      {/* Step 2: verification */}
      <section className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
        <div className="flex items-center justify-between gap-space-md">
          <h2 className="text-headline-sm text-on-surface">2. Identity verification</h2>
          {status === "APPROVED" && <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified</Badge>}
          {status === "PENDING" && <Badge tone="warning"><Hourglass className="h-3.5 w-3.5" aria-hidden /> In review</Badge>}
          {status === "REJECTED" && <Badge tone="error"><XCircle className="h-3.5 w-3.5" aria-hidden /> Needs changes</Badge>}
        </div>
        {status === "APPROVED" && <p className="mt-space-sm flex items-center gap-space-sm text-body-md text-on-surface-variant"><ShieldCheck className="h-5 w-5 text-success" aria-hidden /> You&apos;re verified. {isOwner ? "You can publish loan requests." : "You can make offers."}</p>}
        {status === "PENDING" && <p className="mt-space-sm text-body-md text-on-surface-variant">Our team is reviewing your documents. This usually takes a working day; we&apos;ll notify you.</p>}
        {status === "REJECTED" && verification?.reviewNote && (
          <div className="mt-space-sm"><FormAlert><ShieldAlert className="mr-1 inline h-4 w-4" aria-hidden /> {verification.reviewNote}</FormAlert></div>
        )}
        {canSubmit && (
          <div className="mt-space-md space-y-space-sm">
            {!profileSaved && <FormAlert tone="info">Save your profile first, then upload documents.</FormAlert>}
            {verifyError && <FormAlert>{verifyError}</FormAlert>}
            {fileInput(idDoc ? "NID uploaded" : "Upload your NID (front side)", "ID_DOCUMENT", Boolean(idDoc))}
            {isOwner && fileInput(salesProofs.length ? `${salesProofs.length} sales proof${salesProofs.length > 1 ? "s" : ""} uploaded (add more)` : "Upload a sales proof (bKash, Nagad or bank statement)", "SALES_PROOF", salesProofs.length > 0)}
            {isOwner && <FormField label="Shop link (optional)" placeholder="https://facebook.com/yourshop" value={shopLink} onChange={(e) => setShopLink(e.target.value)} />}
            <p className="text-body-sm text-outline">Documents are private: only you and the verification team can see them.</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={submitVerification} disabled={!profileSaved || uploading !== null}>
                {uploading === "submit" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Submit for review
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
