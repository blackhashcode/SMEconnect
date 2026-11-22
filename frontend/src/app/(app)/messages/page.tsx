import { MessagesWorkspace } from "@/components/domain/MessagesWorkspace";
import { listThreads } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const [{ thread }, user, { threads }] = await Promise.all([searchParams, requireUser("/messages"), listThreads()]);
  const initial = threads.find((item) => item.id === thread)?.id ?? threads[0]?.id ?? null;
  return <MessagesWorkspace threads={threads} initialThreadId={initial} viewerRole={user.role} />;
}
