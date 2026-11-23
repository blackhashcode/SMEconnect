import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileLock2,
  Flag,
  Handshake,
  KeyRound,
  LineChart,
  MessageCircle,
  Search,
  ShieldCheck,
  UserCheck,
  Wallet,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Photo } from "@/components/ui/Photo";
import { Reveal } from "@/components/ui/Reveal";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { images } from "@/data/images";
import { featuredLoanRequests } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";

// Static marketing page, refreshed in the background every minute so the
// featured request stays current without hitting the API per visit.
export const revalidate = 60;

const steps = [
  { icon: UserCheck, title: "Sign up and get verified", text: "Create a free profile, then upload your NID (and trade licence or sales records for businesses). Our team reviews every submission." },
  { icon: Search, title: "Find the right match", text: "Investors browse verified businesses and open loan requests. Owners see who is offering and why." },
  { icon: Handshake, title: "Agree terms together", text: "Make an offer, counter it, or accept it. Both sides confirm the final agreement before anything is binding." },
  { icon: LineChart, title: "Track every repayment", text: "The schedule is generated from the agreed terms. Each instalment is marked paid by the owner and confirmed by the investor." },
];

const safeguards = [
  { icon: BadgeCheck, title: "Every profile is checked by a person", text: "Identity documents are reviewed by the SME Connect team before a member gets the Verified badge. Unverified members can't make or receive offers." },
  { icon: FileLock2, title: "Documents stay private", text: "NID scans, trade licences and payment proofs are never public. Only you, the other party on your loan, and our reviewers can open them." },
  { icon: ClipboardCheck, title: "Two-sided agreements", text: "Terms are written down in the app and both the owner and the investor confirm them. Nobody can change an agreement afterwards." },
  { icon: Wallet, title: "Repayments confirmed by both sides", text: "An instalment only counts as paid when the investor confirms it, so the record both parties see is the same." },
  { icon: Flag, title: "Reporting and moderation", text: "Report a profile, post or message in two taps. Admins review reports, pause suspicious loan requests and suspend accounts that break the rules." },
  { icon: KeyRound, title: "Secure accounts", text: "Email-verified sign-up, hashed passwords, optional Google sign-in, rate-limited logins and HTTPS everywhere. Every sign-in is logged." },
];

export default async function LandingPage() {
  const [featured] = await featuredLoanRequests(1);

  return (
    <>
      <section className="relative overflow-hidden pt-space-xl lg:pt-16">
        <div className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-primary-fixed opacity-50 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-secondary-fixed opacity-40 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-shell items-center gap-space-xl px-margin pb-16 md:px-gutter-desktop lg:grid-cols-2">
          <div className="animate-page-in">
            <Badge tone="success" className="mb-space-md">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified members only
            </Badge>
            <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight text-on-surface sm:text-headline-xl md:text-[56px] md:leading-[1.08]">
              Where Bangladeshi businesses meet their next <span className="text-primary">believer.</span>
            </h1>
            <p className="mt-space-md max-w-xl text-body-lg text-on-surface-variant">
              SME Connect is a professional lending network. Small business owners and individual investors connect
              directly, agree loan terms together and keep a shared record of every repayment.
            </p>
            <div className="mt-space-lg flex flex-wrap gap-space-sm">
              <LinkButton href="/signup" variant="secondary" size="lg">
                Join as a business owner <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/signup" variant="outline" size="lg">
                Join as an investor
              </LinkButton>
            </div>
            <ul className="mt-space-lg flex flex-wrap gap-x-space-lg gap-y-space-sm text-body-sm text-on-surface-variant">
              {["Free to join", "NID-verified profiles", "No money held by us"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-success" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative animate-scale-in [animation-delay:120ms]">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary-fixed to-secondary-fixed opacity-60 blur-xl" />
            {featured ? (
              <div className="relative mx-auto w-full max-w-[440px] rounded-3xl bg-surface-container-lowest p-space-lg card-shadow-lg motion-safe:lg:animate-float">
                <div className="flex items-center gap-space-md">
                  <Avatar src={featured.owner.avatar} alt={featured.owner.name} size="md" priority className="ring-secondary-fixed" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-label-md font-bold text-on-surface">{featured.owner.name}</p>
                      {featured.business.verified && <VerifiedBadge compact />}
                    </div>
                    <p className="truncate text-body-sm text-outline">{featured.business.name} · {featured.business.location}</p>
                  </div>
                  <Badge tone="secondary" className="shrink-0">Open request</Badge>
                </div>
                <Photo src={featured.business.image} alt="" className="mt-space-md h-40 rounded-xl" sizes="440px" priority />
                <h3 className="mt-space-md text-headline-sm text-on-surface">{featured.title}</h3>
                <div className="mt-space-sm grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center">
                  <div><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(featured.amount)}</p></div>
                  <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{featured.rate === null ? "Open" : `${featured.rate}% p.a.`}</p></div>
                  <div><p className="text-label-sm text-outline">Tenure</p><p className="text-label-md font-bold text-on-surface">{tenureLabel(featured.tenureDays)}</p></div>
                </div>
                <LinkButton href={`/businesses/${featured.business.id}`} variant="soft" size="sm" className="mt-space-md w-full">
                  View this business <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
              </div>
            ) : (
              <Photo
                src={images["fruit-vendor"]}
                alt="A fruit seller at his stall in a Bangladeshi market"
                className="relative mx-auto aspect-[4/3] w-full max-w-[520px] rounded-3xl card-shadow-lg"
                sizes="(min-width: 1024px) 520px, 100vw"
                priority
              />
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-shell px-margin md:px-gutter-desktop">
          <Reveal className="text-center">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-space-sm text-headline-lg text-on-surface">From first message to final repayment</h2>
            <p className="mx-auto mt-space-sm max-w-2xl text-body-md text-on-surface-variant">
              Everything happens between real people with verified identities: direct connections, direct offers and a shared repayment record.
            </p>
          </Reveal>
          <div className="mt-space-xl grid gap-space-md sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <Reveal key={step.title} delay={i * 80} className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-primary"><step.icon className="h-6 w-6" aria-hidden /></span>
                <p className="mt-space-md text-label-sm font-bold text-secondary">Step {i + 1}</p>
                <h3 className="mt-1 text-headline-sm text-on-surface">{step.title}</h3>
                <p className="mt-space-sm text-body-md text-on-surface-variant">{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="mx-auto w-full max-w-shell px-margin py-16 md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-label-sm font-bold uppercase tracking-wider text-primary">Why you can trust SME Connect</p>
          <h2 className="mt-space-sm text-headline-lg text-on-surface">Safeguards built into every step</h2>
          <p className="mt-space-sm text-body-md text-on-surface-variant">
            Lending to someone you&apos;ve met online takes trust. These are the checks that apply to every member and every loan.
          </p>
        </Reveal>
        <div className="mt-space-xl grid gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {safeguards.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 80} className="flex gap-space-md rounded-2xl border border-surface-container-high bg-surface-container-lowest p-space-lg">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-container text-success"><item.icon className="h-5 w-5" aria-hidden /></span>
              <div>
                <h3 className="text-label-md font-bold text-on-surface">{item.title}</h3>
                <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="for-businesses" className="bg-surface-container-low py-16">
        <div className="mx-auto grid w-full max-w-shell items-center gap-space-xl px-margin md:px-gutter-desktop lg:grid-cols-2">
          <Reveal className="grid grid-cols-2 gap-space-md pb-space-lg">
            {[
              { src: images["bakery-workers"], alt: "Bakers laying out biscuits on trays" },
              { src: images["textile-fair"], alt: "Women entrepreneurs showing fabric at an SME fair" },
              { src: images["papad-maker"], alt: "A woman drying handmade papad in the sun" },
              { src: images["handicraft-shop"], alt: "A handicraft shop with woven baskets and textiles" },
            ].map((photo, i) => (
              <Photo
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                className={`aspect-[4/3] rounded-2xl card-shadow ${i % 2 === 1 ? "translate-y-space-lg" : ""}`}
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
            ))}
          </Reveal>
          <Reveal delay={120} className="lg:pl-space-lg">
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">For business owners</p>
            <h2 className="mt-space-sm text-headline-lg text-on-surface">Show your real track record, not a pitch deck</h2>
            <p className="mt-space-md text-body-md text-on-surface-variant">
              Your verified profile brings together your identity check, your sales range and your repayment history.
              Post one clear loan request and compare direct offers from investors.
            </p>
            <ul className="mt-space-md space-y-space-sm">
              {["Get verified with your NID and trade licence or sales records", "Post a loan request with the amount, purpose and tenure you need", "Accept, decline or counter every offer"].map((item) => (
                <li key={item} className="flex items-start gap-space-sm text-body-md text-on-surface">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden /> {item}
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" variant="soft" className="mt-space-lg">Create a business profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
          </Reveal>
        </div>
      </section>

      <section id="for-investors" className="mx-auto w-full max-w-shell px-margin py-16 md:px-gutter-desktop">
        <div className="grid items-center gap-space-xl lg:grid-cols-2">
          <Reveal>
            <p className="text-label-sm font-bold uppercase tracking-wider text-primary">For investors</p>
            <h2 className="mt-space-sm text-headline-lg text-on-surface">Lend with clarity, connect with founders</h2>
            <p className="mt-space-md text-body-md text-on-surface-variant">
              Browse verified shops, read what each owner needs the money for, and send an offer on your own terms.
              Once agreed, follow every instalment on your dashboard.
            </p>
            <div className="mt-space-lg grid gap-space-md sm:grid-cols-2">
              <div className="rounded-xl bg-surface-container-low p-space-md"><BadgeCheck className="h-5 w-5 text-primary" aria-hidden /><p className="mt-space-sm text-label-md font-bold text-on-surface">Verified identities</p><p className="text-body-sm text-on-surface-variant">Only reviewed members can receive your offer.</p></div>
              <div className="rounded-xl bg-surface-container-low p-space-md"><MessageCircle className="h-5 w-5 text-primary" aria-hidden /><p className="mt-space-sm text-label-md font-bold text-on-surface">Direct conversations</p><p className="text-body-sm text-on-surface-variant">Ask questions and negotiate in one place, with the full history kept.</p></div>
            </div>
            <LinkButton href="/signup" variant="soft" className="mt-space-lg">Create an investor profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
          </Reveal>
          <Reveal delay={120}>
            <Photo src={images["courier-workers"]} alt="Workers loading parcels at a courier office" className="aspect-[4/3] rounded-3xl card-shadow" sizes="(min-width: 1024px) 50vw, 100vw" />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-surface-container-high bg-surface-container-low py-space-xl">
        <div className="mx-auto w-full max-w-shell px-margin md:px-gutter-desktop">
          <div className="rounded-2xl bg-surface-container-lowest p-space-lg card-shadow md:p-space-xl">
            <h2 className="text-headline-sm text-on-surface">Good to know before you lend or borrow</h2>
            <ul className="mt-space-md grid gap-space-sm text-body-md text-on-surface-variant md:grid-cols-2">
              <li>• SME Connect never holds or moves money. Payments go directly between the two parties.</li>
              <li>• We verify identities, not business success. Every loan carries risk; only lend what you can afford.</li>
              <li>• Interest rates and tenures are agreed between members; we don&apos;t set or guarantee them.</li>
              <li>• If something feels wrong, report it. Our team reviews every report.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-primary px-margin py-16 text-on-primary md:px-gutter-desktop">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-container opacity-60 blur-3xl" />
        <Reveal className="relative mx-auto max-w-shell text-center">
          <ShieldCheck className="mx-auto h-10 w-10" aria-hidden />
          <h2 className="mt-space-md text-headline-lg">Start with a free, verified profile</h2>
          <p className="mx-auto mt-space-sm max-w-2xl text-body-md text-on-primary/80">
            It takes a few minutes to sign up. Verification usually follows once our team has reviewed your documents.
          </p>
          <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
            <LinkButton href="/signup" variant="secondary" size="lg">Create your profile <ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
            <Link href="/login" className="inline-flex h-12 items-center rounded-xl px-space-lg text-label-md font-semibold text-on-primary hover:underline">I already have an account</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
