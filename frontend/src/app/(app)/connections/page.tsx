import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, UsersRound } from "lucide-react";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { MessageButton } from "@/components/domain/MessageButton";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { myConnections, type ConnectionItem } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "My network" };

const profileHref = (c: ConnectionItem) => (c.user.role === "OWNER" ? `/businesses/${c.userId}` : `/investors/${c.userId}`);

function Person({ c, children }: { c: ConnectionItem; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md card-shadow sm:flex-row sm:items-center">
      <Link href={profileHref(c)} className="flex min-w-0 flex-1 items-center gap-space-sm">
        <Avatar src={c.user.image ?? ""} alt={c.user.name} name={c.user.name} size="md" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-label-md font-bold text-on-surface hover:text-primary">{c.user.name}</span>
            {c.user.verified && <VerifiedBadge compact />}
          </span>
          <span className="block truncate text-body-sm text-on-surface-variant">
            {c.user.role === "OWNER" ? c.user.shopName ?? "Business owner" : "Investor"} · <TimeAgo iso={c.createdAt} />
          </span>
          {c.message && <span className="mt-0.5 block text-body-sm italic text-on-surface-variant">“{c.message}”</span>}
        </span>
      </Link>
      <div className="flex flex-wrap gap-space-sm">{children}</div>
    </li>
  );
}

export default async function ConnectionsPage() {
  const user = await requireUser("/connections");
  if (user.role === "admin") redirect("/admin");
  const [incoming, outgoing, connected] = await Promise.all([
    myConnections("PENDING", "incoming"),
    myConnections("PENDING", "outgoing"),
    myConnections("ACCEPTED"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-space-lg">
      <div>
        <p className="text-label-sm font-bold uppercase tracking-wider text-primary">My network</p>
        <h1 className="mt-1 text-headline-lg text-on-surface">Connections</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">Accept requests, follow up on the ones you sent, and message the people you&apos;re connected with.</p>
      </div>

      {incoming.length > 0 && (
        <section className="space-y-space-sm">
          <h2 className="text-headline-sm text-on-surface">Requests for you <span className="text-on-surface-variant">({incoming.length})</span></h2>
          <ul className="space-y-space-sm">
            {incoming.map((c) => (
              <Person key={c.id} c={c}>
                <ConnectButton userId={c.userId} name={c.user.name} initialStatus="incoming" connectionId={c.id} />
              </Person>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-space-sm">
        <h2 className="text-headline-sm text-on-surface">Your connections <span className="text-on-surface-variant">({connected.length})</span></h2>
        {connected.length === 0 ? (
          <EmptyState icon={UsersRound} title="No connections yet" description="Find business owners and investors to connect with." action={<LinkButton href="/explore">Explore members</LinkButton>} />
        ) : (
          <ul className="space-y-space-sm">
            {connected.map((c) => (
              <Person key={c.id} c={c}>
                <MessageButton participantId={c.userId} size="sm"><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
              </Person>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-space-sm">
          <h2 className="text-headline-sm text-on-surface">Requests you sent <span className="text-on-surface-variant">({outgoing.length})</span></h2>
          <ul className="space-y-space-sm">
            {outgoing.map((c) => (
              <Person key={c.id} c={c}>
                <ConnectButton userId={c.userId} name={c.user.name} initialStatus="outgoing" connectionId={c.id} />
              </Person>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
