"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, Building2, Check, Handshake, LoaderCircle, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { FormAlert, FormField, postJson, type FieldErrors } from "@/components/auth/FormField";
import { images } from "@/data/images";
import { cn } from "@/lib/cn";

const roles = [
  {
    id: "business",
    title: "I run a business",
    description: "Show verified sales records, request the capital you need and compare direct offers.",
    perks: ["NID & trade licence verification", "Post a transparent loan request", "Connect with relevant investors"],
    icon: Building2,
    image: images["boutique-sarees"],
    cta: "Create business profile",
  },
  {
    id: "investor",
    title: "I want to invest",
    description: "Discover verified local shops, make direct loan offers and follow agreed repayments.",
    perks: ["Browse verified businesses", "Make offers with your own terms", "Track repayments in one dashboard"],
    icon: TrendingUp,
    image: images["investor-mobile"],
    cta: "Create investor profile",
  },
] as const;

type RoleId = (typeof roles)[number]["id"];

const categories = ["Food & Beverage", "Textile & Fashion", "Handicrafts", "Logistics", "Beauty & Personal Care", "Food & Agriculture", "Retail", "Other"];

export function RoleSelector() {
  const router = useRouter();
  const [selected, setSelected] = useState<RoleId>("business");
  const role = roles.find((item) => item.id === selected) ?? roles[0];
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", businessName: "", category: categories[0], location: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    if (fields[key]) setFields((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const body = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      role: selected,
      location: form.location,
      ...(selected === "business" ? { businessName: form.businessName, category: form.category } : {}),
    };
    const result = await postJson("/api/v1/auth/signup", body);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields);
      setPending(false);
      return;
    }
    // Moving from the public layout to the app layout; start the new page at the top.
    window.scrollTo({ top: 0 });
    router.replace("/feed");
    router.refresh();
  }

  return (
    <div>
      <div className="grid gap-space-md md:grid-cols-2" role="radiogroup" aria-label="Account type">
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-label={item.title}
            onClick={() => setSelected(item.id)}
            aria-checked={selected === item.id}
            className={cn(
              "group overflow-hidden rounded-3xl border-2 bg-surface-container-lowest text-left card-shadow transition-all duration-300 ease-out-expo hover:-translate-y-1",
              selected === item.id ? "border-primary shadow-card-hover" : "border-transparent",
            )}
          >
            <div className="relative h-44">
              <Photo src={item.image} alt="" className="absolute inset-0" sizes="(min-width: 768px) 50vw, 100vw" priority zoomOnHover />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/70 via-inverse-surface/10 to-transparent" />
              <span className="absolute bottom-space-md left-space-md flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 text-primary">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              <span
                className={cn(
                  "absolute right-space-md top-space-md flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary transition-all duration-300",
                  selected === item.id ? "scale-100 opacity-100" : "scale-50 opacity-0",
                )}
              >
                <Check className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <div className="p-space-lg">
              <p className="text-headline-sm text-on-surface">{item.title}</p>
              <p className="mt-space-sm text-body-md text-on-surface-variant">{item.description}</p>
              <ul className="mt-space-md space-y-space-sm">
                {item.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-space-sm text-body-sm text-on-surface-variant">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden /> {perk}
                  </li>
                ))}
              </ul>
            </div>
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-space-lg rounded-3xl bg-surface-container-lowest p-space-lg card-shadow md:p-space-xl">
        <div className="flex flex-wrap items-start justify-between gap-space-md">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Create your {selected} account</p>
            <h2 className="mt-1 text-headline-md text-on-surface">{role.cta}</h2>
          </div>
          <div className="flex flex-wrap gap-space-sm">
            <span className="flex items-center gap-1.5 rounded-full bg-success-container px-space-md py-1.5 text-body-sm font-medium text-success">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Free forever
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-primary-fixed px-space-md py-1.5 text-body-sm font-medium text-primary">
              <Handshake className="h-4 w-4" aria-hidden /> Direct offers only
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-space-md">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <div className="mt-space-lg grid gap-space-md sm:grid-cols-2">
          <FormField label="Full name" name="name" autoComplete="name" placeholder="e.g. Ayesha Rahman" value={form.name} onChange={update("name")} error={fields.name?.[0]} required />
          <FormField label="Email address" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update("email")} error={fields.email?.[0]} required />
          <FormField label="Phone number (optional)" type="tel" name="phone" autoComplete="tel" placeholder="+880 1XXX-XXXXXX" value={form.phone} onChange={update("phone")} error={fields.phone?.[0]} />
          <FormField
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint="At least 8 characters, with a letter and a number."
            value={form.password}
            onChange={update("password")}
            error={fields.password?.[0]}
            required
          />
          {selected === "business" && (
            <>
              <FormField label="Business name" name="businessName" autoComplete="organization" placeholder="e.g. Rahman Textiles" value={form.businessName} onChange={update("businessName")} error={fields.businessName?.[0]} required className="animate-fade-in" />
              <div className="animate-fade-in">
                <label htmlFor="signup-category" className="mb-1.5 block text-label-md font-semibold text-on-surface">
                  Category
                </label>
                <select
                  id="signup-category"
                  value={form.category}
                  onChange={update("category")}
                  className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md text-body-md text-on-surface transition-[border-color,box-shadow] hover:border-outline focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <FormField label="City or district (optional)" name="location" autoComplete="address-level2" placeholder="e.g. Sylhet" value={form.location} onChange={update("location")} error={fields.location?.[0]} />
        </div>

        <div className="mt-space-lg flex flex-col-reverse items-stretch justify-between gap-space-md border-t border-surface-container-high pt-space-lg sm:flex-row sm:items-center">
          <p className="text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
          <Button type="submit" variant="secondary" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {pending ? "Creating your account…" : role.cta}
            {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </form>
    </div>
  );
}
