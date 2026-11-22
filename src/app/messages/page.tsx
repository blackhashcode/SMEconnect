import { AppShell } from "@/components/layout/AppShell";
import { MessagesWorkspace } from "@/components/domain/MessagesWorkspace";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <AppShell>
      <MessagesWorkspace />
    </AppShell>
  );
}
