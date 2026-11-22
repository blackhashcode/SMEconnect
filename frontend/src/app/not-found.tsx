import { Compass } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { LinkButton } from "@/components/ui/Button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-margin text-center">
      <BrandLogo />
      <span className="mt-space-xl flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
        <Compass className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-space-lg text-headline-lg text-on-surface">We couldn&apos;t find that page</h1>
      <p className="mt-space-sm max-w-md text-body-md text-on-surface-variant">
        The link may be out of date, or the profile or request is no longer available.
      </p>
      <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
        <LinkButton href="/feed">Go to your feed</LinkButton>
        <LinkButton href="/" variant="outline">
          Back to home
        </LinkButton>
      </div>
    </div>
  );
}
