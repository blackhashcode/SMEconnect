import { MessagesWorkspace } from "@/components/domain/MessagesWorkspace";
import { listConversations } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const [{ conversation }, , conversations] = await Promise.all([searchParams, requireUser("/messages"), listConversations()]);
  const initial = conversations.find((item) => item.id === conversation)?.id ?? conversations[0]?.id ?? null;
  return <MessagesWorkspace conversations={conversations} initialId={initial} />;
}
