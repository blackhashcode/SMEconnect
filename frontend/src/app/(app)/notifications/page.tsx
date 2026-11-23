import { NotificationCenter } from "@/components/domain/NotificationCenter";
import { listNotifications } from "@/lib/api";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  return <NotificationCenter notifications={await listNotifications()} />;
}
