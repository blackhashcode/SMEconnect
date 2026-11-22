"use client";

import { useState } from "react";
import { ArrowRight, BadgeCheck, Building2, Check, Handshake, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
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

export function RoleSelector() {
  const [selected, setSelected] = useState<(typeof roles)[number]["id"]>("business");
  const role = roles.find((item) => item.id === selected) ?? roles[0];

  return (
    <div>
      <div className="grid gap-space-md md:grid-cols-2">
        {roles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item.id)}
            aria-pressed={selected === item.id}
            className={cn(
              "group overflow-hidden rounded-3xl border-2 bg-surface-container-lowest text-left transition-all card-shadow hover:-translate-y-1",
              selected === item.id ? "border-primary shadow-card-hover" : "border-transparent",
            )}
          >
            <div className="relative h-44 overflow-hidden bg-surface-container">
              <img src={item.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/70 via-inverse-surface/10 to-transparent" />
              <span className="absolute bottom-space-md left-space-md flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 text-primary">
                <item.icon className="h-5 w-5" aria-hidden />
              </span>
              {selected === item.id && <span className="absolute right-space-md top-space-md flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary"><Check className="h-4 w-4" aria-hidden /></span>}
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

      <div className="mt-space-lg rounded-3xl bg-surface-container-lowest p-space-lg card-shadow">
        <div className="grid gap-space-lg md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Create your {selected} account</p>
            <h2 className="mt-1 text-headline-md text-on-surface">{role.cta}</h2>
            <div className="mt-space-md grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
              {["Full name", "Email address", "Phone number", "Password"].map((label) => (
                <label key={label} className="block">
                  <span className="mb-space-sm block text-label-sm font-bold text-outline">{label}</span>
                  <input type={label === "Password" ? "password" : "text"} placeholder={label} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none" />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start gap-space-sm md:w-56">
            <div className="flex items-center gap-space-sm rounded-xl bg-success-container px-space-md py-space-sm text-body-sm text-success"><ShieldCheck className="h-4 w-4" aria-hidden /> Free forever</div>
            <div className="flex items-center gap-space-sm rounded-xl bg-primary-fixed px-space-md py-space-sm text-body-sm text-primary"><Handshake className="h-4 w-4" aria-hidden /> Direct offers only</div>
            <LinkButton href="/feed" variant="secondary" className="w-full">Continue <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoleIcon() {
  return <UserRound className="h-4 w-4" aria-hidden />;
}
