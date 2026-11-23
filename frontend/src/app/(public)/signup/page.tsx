import { BadgeCheck, LockKeyhole, MessageSquareText, ShieldCheck } from "lucide-react";
import { RoleSelector } from "@/components/domain/RoleSelector";
import { Badge } from "@/components/ui/Badge";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { authOptions } from "@/lib/api";

export const metadata = { title: "Join SME Connect" };

export default async function SignupPage() {
  // Already signed in? Skip straight to the app. (If the API is down, still show the form.)
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/feed");
  const { google } = await authOptions();

  return (
    <>
      <section className="bg-surface-container-low px-margin pb-16 pt-space-xl md:px-gutter-desktop lg:pt-16">
        <div className="mx-auto w-full max-w-shell">
          <div className="text-center">
            <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> NID verified network</Badge>
            <h1 className="mt-space-md text-headline-lg text-on-surface md:text-headline-xl">Choose how you want to connect</h1>
            <p className="mx-auto mt-space-sm max-w-2xl text-body-lg text-on-surface-variant">
              Business owners raise direct loan offers. Investors build relationships with verified local founders. Both start with a free profile.
            </p>
          </div>
          <div className="mt-space-xl"><RoleSelector googleEnabled={google} /></div>
          <div className="stagger mt-space-lg grid gap-space-md sm:grid-cols-3">
            {[
              { icon: BadgeCheck, title: "Verified identities", text: "NID and trade licence checks keep the network trustworthy." },
              { icon: MessageSquareText, title: "Direct conversations", text: "Discuss and negotiate terms with the people involved." },
              { icon: LockKeyhole, title: "Your data stays yours", text: "Financial records are only shown to members you connect with." },
            ].map((item) => (
              <div key={item.title} className="flex gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"><item.icon className="h-5 w-5" aria-hidden /></span>
                <div><p className="text-label-md font-bold text-on-surface">{item.title}</p><p className="mt-0.5 text-body-sm text-on-surface-variant">{item.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
