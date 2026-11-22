/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { MapPin, Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import type { Person } from "@/data/types";

export function ProfileHeader({ person, actions }: { person: Person; actions?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-surface-container-lowest card-shadow">
      <div className="relative h-44 overflow-hidden bg-surface-container md:h-56">
        <img src={person.cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/50 to-transparent" />
      </div>
      <div className="relative px-space-lg pb-space-lg">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-space-md">
          <div className="flex items-end gap-space-md">
            <Avatar src={person.avatar} alt={person.name} size="2xl" className="ring-4 ring-surface-container-lowest" />
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-headline-lg text-on-surface">{person.name}</h1>
                {person.verified && <VerifiedBadge />}
              </div>
              <p className="mt-1 text-body-md text-on-surface-variant">{person.headline}</p>
              <div className="mt-space-sm flex flex-wrap items-center gap-space-md text-body-sm text-outline">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {person.location}</span>
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" aria-hidden /> {person.rating}</span>
                <span>{person.connections} connections</span>
                <span>Joined {person.joined}</span>
              </div>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-space-sm pb-1">{actions}</div>}
        </div>
        <p className="mt-space-md max-w-3xl text-body-md leading-relaxed text-on-surface-variant">{person.about}</p>
      </div>
    </section>
  );
}
