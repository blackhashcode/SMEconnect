/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { images } from "@/data/images";
import { cn } from "@/lib/cn";

export function BrandLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-space-sm", className)} aria-label="SME Connect home">
      <img src={images.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
      <span className="text-headline-sm font-bold tracking-tight text-on-surface">SME Connect</span>
    </Link>
  );
}
