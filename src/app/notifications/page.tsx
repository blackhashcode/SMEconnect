import { AppShell } from "@/components/layout/AppShell";
import { NotificationCenter } from "@/components/domain/NotificationCenter";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationCenter />
    </AppShell>
  );
}
