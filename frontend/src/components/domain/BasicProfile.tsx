import { Hourglass, MessageCircle } from "lucide-react";
import { ConnectButton } from "@/components/domain/ConnectButton";
import { MessageButton } from "@/components/domain/MessageButton";
import { ProfileHeader } from "@/components/domain/ProfileHeader";
import { ProfileActions } from "@/components/social/ProfileActions";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ConnectionStatusResult } from "@/lib/api";
import type { Person, SessionUser } from "@/data/types";
import { firstName } from "@/lib/format";

/**
 * Shown for a member who hasn't finished onboarding: who they are, and the
 * usual ways to connect, instead of a "not found" page.
 */
export function BasicProfile({ person, viewer, relation }: { person: Person; viewer: SessionUser | null; relation: ConnectionStatusResult | null }) {
  const own = viewer?.id === person.id;
  const roleLabel = person.role === "business" ? "Business owner" : "Investor";
  const short = firstName(person.name);

  return (
    <>
      <ProfileHeader
        person={{ ...person, headline: roleLabel, about: "", location: "" }}
        actions={
          own ? (
            <LinkButton href="/onboarding" variant="secondary">Finish your profile</LinkButton>
          ) : viewer && viewer.role !== "admin" ? (
            <>
              <ConnectButton userId={person.id} name={person.name} initialStatus={relation?.status} connectionId={relation?.connectionId} />
              <MessageButton participantId={person.id}><MessageCircle className="h-4 w-4" aria-hidden /> Message</MessageButton>
              <ProfileActions userId={person.id} name={person.name} following={relation?.following ?? false} blocked={relation?.blockedByMe ?? false} />
            </>
          ) : null
        }
      />
      <Card className="mt-space-lg flex items-start gap-space-md p-space-lg">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary">
          <Hourglass className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-headline-sm text-on-surface">{own ? "Your profile isn't set up yet" : `${short} is still setting up their profile`}</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {own
              ? person.role === "business"
                ? "Add your business details and verification documents so investors can find you and make offers."
                : "Add your lending preferences and verification documents so businesses can find you."
              : person.role === "business"
                ? `Business details, sales and lending history will appear here once ${short} completes their profile. You can still connect or send a message.`
                : `Lending preferences and history will appear here once ${short} completes their profile. You can still connect or send a message.`}
          </p>
        </div>
      </Card>
    </>
  );
}
