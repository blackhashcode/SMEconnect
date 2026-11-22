import type { ReactNode } from "react";
import { BadgeCheck, Handshake, ShieldCheck } from "lucide-react";
import { Photo } from "@/components/ui/Photo";

/** Two-panel layout shared by the login and sign-up pages. */
export function AuthShell({
  title,
  subtitle,
  image,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  image: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-surface-container-low px-margin py-space-xl md:px-gutter-desktop lg:py-16">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary-fixed opacity-50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-secondary-fixed opacity-40 blur-3xl" />

      <div
        className={`relative mx-auto grid w-full animate-scale-in overflow-hidden rounded-3xl bg-surface-container-lowest card-shadow-lg lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] ${wide ? "max-w-6xl" : "max-w-5xl"}`}
      >
        <Photo src={image} alt="" className="hidden min-h-full lg:block" sizes="45vw" priority>
          <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-space-xl text-white">
            <p className="text-headline-md">Direct offers between verified people.</p>
            <ul className="mt-space-md space-y-space-sm text-body-sm text-white/85">
              <li className="flex items-center gap-space-sm"><BadgeCheck className="h-4 w-4 shrink-0" aria-hidden /> NID and trade licence checked profiles</li>
              <li className="flex items-center gap-space-sm"><Handshake className="h-4 w-4 shrink-0" aria-hidden /> Negotiate terms in one shared thread</li>
              <li className="flex items-center gap-space-sm"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> Records only shared with your connections</li>
            </ul>
          </div>
        </Photo>

        <div className="p-space-lg sm:p-space-xl">
          <h1 className="text-headline-lg text-on-surface">{title}</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p>
          <div className="mt-space-lg">{children}</div>
        </div>
      </div>
    </section>
  );
}
