import { NotificationCenter } from "@/components/domain/NotificationCenter";
import { listNotifications } from "@/lib/api";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { notifications } = await listNotifications();
  return <NotificationCenter initialNotifications={notifications} />;
}
