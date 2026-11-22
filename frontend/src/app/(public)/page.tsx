import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Handshake,
  LineChart,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { images } from "@/data/images";
import { loanRequests, formatBDT } from "@/data/loans";
import { businessById } from "@/data/businesses";
import { personById } from "@/data/users";

const steps = [
  { icon: Search, title: "Discover verified businesses", text: "Browse NID and trade-licence checked shops with real track records." },
  { icon: Handshake, title: "Connect and make an offer", text: "Message the owner directly and propose terms that work for both sides." },
  { icon: LineChart, title: "Track agreed repayments", text: "See every agreed instalment in one transparent, shared timeline." },
];

export default function LandingPage() {
  const featured = loanRequests[0];
  const business = businessById(featured.businessId);
  const owner = business ? personById(business.ownerId) : undefined;

  return (
    <>
      <section className="relative overflow-hidden pt-space-xl lg:pt-16">
        <div className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-primary-fixed opacity-50 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-secondary-fixed opacity-40 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-shell items-center gap-space-xl px-margin pb-16 md:px-gutter-desktop lg:grid-cols-2">
          <div className="animate-page-in">
            <Badge tone="success" className="mb-space-md">
              <span className="h-2 w-2 rounded-full bg-success" /> 2,400+ verified businesses
            </Badge>
            <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight text-on-surface sm:text-headline-xl md:text-[56px] md:leading-[1.08]">
              Where Bangladeshi businesses meet their next <span className="text-primary">believer.</span>
            </h1>
            <p className="mt-space-md max-w-xl text-body-lg text-on-surface-variant">
              SME Connect is a professional lending network. Connect with verified shop owners, make a direct loan
              offer and grow together on terms you agree.
            </p>
            <div className="mt-space-lg flex flex-wrap gap-space-sm">
              <LinkButton href="/signup" variant="secondary" size="lg">
                Join as a business owner <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/signup" variant="outline" size="lg">
                Join as an investor
              </LinkButton>
            </div>
            <div className="mt-space-lg flex flex-wrap items-center gap-space-md">
              <div className="flex -space-x-2">
                {[images["landing-baker"], images["landing-garment"], images["landing-pottery"], images["rafiq-portrait"]].map((src) => (
                  <Avatar key={src} src={src} alt="" size="xs" priority className="relative" />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-warning">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" aria-hidden />)}
                  <span className="ml-1 text-label-sm font-bold text-on-surface">4.9</span>
                </div>
                <p className="text-body-sm text-outline">Trusted by founders and investors in 64 districts</p>
              </div>
            </div>
          </div>

          <div className="relative animate-scale-in [animation-delay:120ms]">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary-fixed to-secondary-fixed opacity-60 blur-xl" />
            <div className="relative mx-auto w-full max-w-[440px] rounded-3xl bg-surface-container-lowest p-space-lg card-shadow-lg motion-safe:lg:animate-float">
              <div className="flex items-center gap-space-md">
                {owner && <Avatar src={owner.avatar} alt={owner.name} size="md" priority className="ring-secondary-fixed" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="whitespace-nowrap text-label-md font-bold text-on-surface">{owner?.name}</p>
                    <VerifiedBadge compact />
                  </div>
                  <p className="text-body-sm text-outline">{business?.name} · Dhaka</p>
                </div>
                <Badge tone="secondary" className="shrink-0">Open request</Badge>
              </div>
              <Photo src={featured.image} alt="Commercial bakery oven" className="mt-space-md h-40 rounded-xl" sizes="440px" priority />
              <h3 className="mt-space-md text-headline-sm text-on-surface">{featured.title}</h3>
              <div className="mt-space-sm grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
                <div><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(featured.amount)}</p></div>
                <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{featured.rate}% p.a.</p></div>
                <div><p className="text-label-sm text-outline">Offers</p><p className="text-label-md font-bold text-on-surface">{featured.offersCount}</p></div>
              </div>
              <div className="mt-space-md"><ProgressBar value={featured.progress} label="Request progress" /></div>
              <LinkButton href={`/businesses/${business?.id}`} variant="soft" size="sm" className="mt-space-md w-full">
                View this business <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-surface-container-high bg-surface-container-low py-space-lg">
        <div className="mx-auto grid w-full max-w-shell grid-cols-2 gap-space-lg px-margin md:grid-cols-4 md:px-gutter-desktop">
          {[
            { icon: BadgeCheck, value: "2,400+", label: "Verified businesses" },
            { icon: UsersRound, value: "18,000+", label: "Connected investors" },
            { icon: TrendingUp, value: "৳42 Cr", label: "Offers made" },
            { icon: ShieldCheck, value: "100%", label: "On-time record tracking" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-space-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary"><item.icon className="h-5 w-5" aria-hidden /></span>
              <div><p className="text-numeric-stat text-on-surface">{item.value}</p><p className="text-body-sm text-outline">{item.label}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-shell px-margin py-16 md:px-gutter-desktop">
        <Reveal className="text-center">
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">How it works</p>
          <h2 className="mt-space-sm text-headline-lg text-on-surface">A simpler way to back local business</h2>
          <p className="mx-auto mt-space-sm max-w-2xl text-body-md text-on-surface-variant">
            Everything happens between real people with verified identities — direct connections, direct offers and shared repayment records.
          </p>
        </Reveal>
        <div className="mt-space-xl grid gap-space-md md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100} className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow card-interactive">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-primary"><step.icon className="h-6 w-6" aria-hidden /></span>
              <p className="mt-space-md text-label-sm font-bold text-secondary">Step {i + 1}</p>
              <h3 className="mt-1 text-headline-sm text-on-surface">{step.title}</h3>
              <p className="mt-space-sm text-body-md text-on-surface-variant">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="for-businesses" className="bg-surface-container-low py-16">
        <div className="mx-auto grid w-full max-w-shell items-center gap-space-xl px-margin md:px-gutter-desktop lg:grid-cols-2">
          <Reveal className="grid grid-cols-2 gap-space-md pb-space-lg">
            {[
              { src: images["nusrat-cloud-kitchen"], alt: "Cloud kitchen" },
              { src: images["boutique-punjabis"], alt: "Boutique clothing" },
              { src: images["terracotta-glazed"], alt: "Handmade ceramics" },
              { src: images["electric-fleet"], alt: "Electric delivery fleet" },
            ].map((photo, i) => (
              <Photo
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                className={`group aspect-[4/5] rounded-2xl card-shadow sm:aspect-[4/3] ${i % 2 === 1 ? "translate-y-space-lg" : ""}`}
                sizes="(min-width: 1024px) 25vw, 50vw"
                zoomOnHover
              />
            ))}
          </Reveal>
          <Reveal delay={120} className="lg:pl-space-lg">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">For business owners</p>
            <h2 className="mt-space-sm text-headline-lg text-on-surface">Show your real track record, not a pitch deck</h2>
            <p className="mt-space-md text-body-md text-on-surface-variant">
              Your verified profile brings together trade licence checks, prior repayments, customer ratings and the
              exact terms you need. Investors reach out with offers you can accept, decline or negotiate.
            </p>
            <ul className="mt-space-md space-y-space-sm">
              {["Get verified with NID and trade licence", "Post a clear loan request with your terms", "Compare direct offers side by side"].map((item) => (
                <li key={item} className="flex items-center gap-space-sm text-body-md text-on-surface">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden /> {item}
                </li>
              ))}
            </ul>
            <LinkButton href="/businesses/crave-co" variant="soft" className="mt-space-lg">See a business profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
          </Reveal>
        </div>
      </section>

      <section id="for-investors" className="mx-auto w-full max-w-shell px-margin py-16 md:px-gutter-desktop">
        <div className="grid items-center gap-space-xl lg:grid-cols-2">
          <Reveal>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">For investors</p>
            <h2 className="mt-space-sm text-headline-lg text-on-surface">Lend with clarity, connect with founders</h2>
            <p className="mt-space-md text-body-md text-on-surface-variant">
              Browse verified shops, review real numbers and send a direct offer. You agree the rate, tenure and
              repayment date together — then follow progress in a shared dashboard.
            </p>
            <div className="mt-space-lg grid gap-space-md sm:grid-cols-2">
              <div className="rounded-xl bg-surface-container-low p-space-md"><Building2 className="h-5 w-5 text-primary" aria-hidden /><p className="mt-space-sm text-label-md font-bold text-on-surface">Verified identities</p><p className="text-body-sm text-on-surface-variant">NID and trade licence checks on every profile.</p></div>
              <div className="rounded-xl bg-surface-container-low p-space-md"><MessageCircle className="h-5 w-5 text-primary" aria-hidden /><p className="mt-space-sm text-label-md font-bold text-on-surface">Direct conversations</p><p className="text-body-sm text-on-surface-variant">Negotiate terms in one place, with a full history.</p></div>
            </div>
            <LinkButton href="/investors/rafiq" variant="soft" className="mt-space-lg">See an investor profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
          </Reveal>
          <Reveal delay={120} className="rounded-3xl bg-surface-container-lowest p-space-lg card-shadow">
            <p className="text-label-sm font-bold uppercase tracking-wider text-outline">A typical conversation</p>
            <div className="mt-space-md space-y-space-sm">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-container-low p-space-sm text-body-md text-on-surface">I reviewed your repayment history — impressed. What tenure works best?</div>
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary p-space-sm text-body-md text-on-primary">12 months with monthly repayments on the 10th.</div>
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-container-low p-space-sm text-body-md text-on-surface">Perfect. Send the offer and let&apos;s get started.</div>
            </div>
            <div className="mt-space-md flex items-center gap-space-sm rounded-xl bg-success-container p-space-sm text-body-sm text-success">
              <Handshake className="h-4 w-4 shrink-0" aria-hidden /> Offer agreed · ৳150,000 · 10.5% p.a. · 12 months
            </div>
          </Reveal>
        </div>
      </section>

      <section id="trust" className="relative overflow-hidden bg-primary px-margin py-16 text-on-primary md:px-gutter-desktop">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-container opacity-60 blur-3xl" />
        <Reveal className="relative mx-auto max-w-shell text-center">
          <ShieldCheck className="mx-auto h-10 w-10" aria-hidden />
          <h2 className="mt-space-md text-headline-lg">Trust is built into every connection</h2>
          <p className="mx-auto mt-space-sm max-w-2xl text-body-md text-on-primary/80">
            Verified identities, transparent terms and a shared repayment record. SME Connect is a network built for
            direct business relationships and agreed lending terms.
          </p>
          <LinkButton href="/signup" variant="secondary" size="lg" className="mt-space-lg">Create your free profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
        </Reveal>
      </section>
    </>
  );
}
