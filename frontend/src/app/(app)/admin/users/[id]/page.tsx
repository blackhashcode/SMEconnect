import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, LogOut, ShieldBan, ShieldCheck } from "lucide-react";
import { AdminAction } from "@/components/admin/AdminAction";
import { AdminTable, Cell, StatusBadge, dateTime } from "@/components/admin/AdminTable";
import { Avatar } from "@/components/ui/Avatar";
import { Card, SectionHeading } from "@/components/ui/Card";
import { adminUser, auditLogs, describeAction } from "@/lib/admin";
import { getProfile } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Member · Admin" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, profile, byThem, aboutThem, viewer] = await Promise.all([
    adminUser(id),
    getProfile(id),
    auditLogs({ actorId: id, limit: 20 }),
    auditLogs({ targetId: id, category: "admin.", limit: 10 }),
    getCurrentUser(),
  ]);
  if (!user) notFound();
  const publicHref = user.role === "OWNER" ? `/businesses/${id}` : user.role === "INVESTOR" ? `/investors/${id}` : null;
  const canModerate = user.role !== "ADMIN" && viewer?.id !== id;
  const lastSignIn = byThem.items.find((entry) => entry.action === "auth.sign_in");

  return (
    <div className="space-y-space-lg">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> All members</Link>

      <Card className="p-space-lg">
        <div className="flex flex-col gap-space-md md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-space-md">
            <Avatar src={profile?.person.avatar ?? ""} alt={user.name} name={user.name} size="xl" />
            <div className="min-w-0">
              <h2 className="break-words text-headline-md text-on-surface">{user.name}</h2>
              <p className="text-body-md text-on-surface-variant">{user.email}</p>
              <div className="mt-space-sm flex flex-wrap items-center gap-space-sm">
                <StatusBadge status={user.status} />
                <span className="text-body-sm text-on-surface-variant">{user.role.charAt(0) + user.role.slice(1).toLowerCase()} · trust score {user.trustScore} · {user.openReportsAgainst} open report{user.openReportsAgainst === 1 ? "" : "s"}</span>
              </div>
              <p className="mt-1 text-body-sm text-outline">
                Joined {dateTime(user.createdAt)}
                {lastSignIn ? ` · last sign-in ${dateTime(lastSignIn.createdAt)}${lastSignIn.ipAddress ? ` from ${lastSignIn.ipAddress}` : ""}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-space-sm md:justify-end">
            {publicHref && (
              <Link href={publicHref} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-label-md font-semibold text-primary hover:bg-primary-fixed"><ExternalLink className="h-4 w-4" aria-hidden /> Public profile</Link>
            )}
            {canModerate && (user.status === "ACTIVE" ? (
              <AdminAction endpoint={`/admin/users/${id}/suspend`} label="Suspend" confirm={`Suspend ${user.name}? They are signed out and can't use the app until reactivated.`} icon={<ShieldBan className="h-4 w-4" aria-hidden />} />
            ) : (
              <AdminAction endpoint={`/admin/users/${id}/reactivate`} label="Reactivate" variant="success" confirm={`Reactivate ${user.name}?`} icon={<ShieldCheck className="h-4 w-4" aria-hidden />} />
            ))}
            {canModerate && (
              <AdminAction endpoint={`/admin/users/${id}/sessions`} method="DELETE" label="Sign out everywhere" variant="ghost" confirm={`Sign ${user.name} out of every device?`} icon={<LogOut className="h-4 w-4" aria-hidden />} />
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-space-lg lg:grid-cols-2">
        <Card className="p-space-lg">
          <SectionHeading title="Profile" />
          {profile?.business ? (
            <dl className="mt-space-md grid grid-cols-[140px_1fr] gap-y-2 text-body-sm">
              <dt className="text-outline">Shop</dt><dd className="text-on-surface">{profile.business.name}</dd>
              <dt className="text-outline">Category</dt><dd className="text-on-surface">{profile.business.category}</dd>
              <dt className="text-outline">Location</dt><dd className="text-on-surface">{profile.business.location || "—"}</dd>
              <dt className="text-outline">About</dt><dd className="text-on-surface">{profile.business.description || "—"}</dd>
              <dt className="text-outline">Links</dt>
              <dd className="flex flex-wrap gap-2">{profile.business.links.length ? profile.business.links.map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">{link.label}</a>) : "—"}</dd>
            </dl>
          ) : profile ? (
            <dl className="mt-space-md grid grid-cols-[140px_1fr] gap-y-2 text-body-sm">
              <dt className="text-outline">Headline</dt><dd className="text-on-surface">{profile.person.headline || "—"}</dd>
              <dt className="text-outline">Location</dt><dd className="text-on-surface">{profile.person.location || "—"}</dd>
              <dt className="text-outline">About</dt><dd className="text-on-surface">{profile.person.about || "—"}</dd>
            </dl>
          ) : (
            <p className="mt-space-md text-body-sm text-on-surface-variant">No profile set up yet.</p>
          )}
        </Card>

        <Card className="p-space-lg">
          <SectionHeading title="Verification history" />
          {user.verifications.length === 0 ? (
            <p className="mt-space-md text-body-sm text-on-surface-variant">Nothing submitted yet.</p>
          ) : (
            <ul className="mt-space-md space-y-space-md">
              {user.verifications.map((v) => (
                <li key={v.id} className="rounded-xl border border-surface-container-high p-space-sm">
                  <div className="flex items-center justify-between gap-space-sm">
                    <StatusBadge status={v.status} />
                    <span className="text-body-sm text-outline">{dateTime(v.submittedAt)}</span>
                  </div>
                  {v.reviewNote && <p className="mt-1 text-body-sm text-on-surface-variant">Note: {v.reviewNote}</p>}
                  <div className="mt-space-sm flex flex-wrap gap-space-sm text-body-sm">
                    <a href={v.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><FileText className="h-4 w-4" aria-hidden /> ID document</a>
                    {v.salesProofUrls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><FileText className="h-4 w-4" aria-hidden /> Sales proof {i + 1}</a>
                    ))}
                    {v.shopLinks.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-4 w-4" aria-hidden /> Shop link</a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="space-y-space-sm">
        <h2 className="text-headline-sm text-on-surface">Their recent activity</h2>
        <AdminTable head={["When", "What", "IP address"]} empty={byThem.items.length === 0}>
          {byThem.items.map((entry) => (
            <tr key={entry.id}>
              <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(entry.createdAt)}</Cell>
              <Cell>{describeAction(entry.action)}</Cell>
              <Cell className="text-on-surface-variant">{entry.ipAddress ?? "—"}</Cell>
            </tr>
          ))}
        </AdminTable>
      </section>

      {aboutThem.items.length > 0 && (
        <section className="space-y-space-sm">
          <h2 className="text-headline-sm text-on-surface">Admin actions on this member</h2>
          <AdminTable head={["When", "Admin", "Action"]}>
            {aboutThem.items.map((entry) => (
              <tr key={entry.id}>
                <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(entry.createdAt)}</Cell>
                <Cell>{entry.actor?.name ?? "—"}</Cell>
                <Cell>{describeAction(entry.action)}</Cell>
              </tr>
            ))}
          </AdminTable>
        </section>
      )}
    </div>
  );
}
