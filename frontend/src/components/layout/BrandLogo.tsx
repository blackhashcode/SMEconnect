import Image from "next/image";
import Link from "next/link";
import { images } from "@/data/images";
import { cn } from "@/lib/cn";

export function BrandLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex shrink-0 items-center gap-space-sm rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", className)}
      aria-label="SME Connect home"
    >
      <Image src={images.logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" priority unoptimized />
      <span className="whitespace-nowrap text-headline-sm font-bold tracking-tight text-on-surface">SME Connect</span>
    </Link>
  );
}
