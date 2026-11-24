"use client";

import { useState } from "react";
import { LoaderCircle, Newspaper } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/client-api";
import type { components } from "@/lib/backend/schema";
import { PostCard } from "./PostCard";
import { PostComposer } from "./PostComposer";

type Post = components["schemas"]["PostRecord"];

/** The member's feed: composer on top, posts below, with "Load more". */
export function PostFeed({
  initial,
  nextCursor: initialCursor,
  viewer,
  source = "/feed",
  showComposer = true,
}: {
  initial: Post[];
  nextCursor: string | null;
  viewer: { id: string; name: string; avatar: string; isOwner: boolean; isAdmin?: boolean };
  /** API path to page through: /feed, or /posts?authorId=... on a profile. */
  source?: string;
  showComposer?: boolean;
}) {
  const [posts, setPosts] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    const join = source.includes("?") ? "&" : "?";
    const result = await api.get<Post[]>(`${source}${join}limit=20&cursor=${encodeURIComponent(cursor)}`);
    setLoading(false);
    if (!result.ok) return;
    setPosts((list) => [...list, ...result.data.filter((p) => !list.some((x) => x.id === p.id))]);
    setCursor(result.meta?.nextCursor ?? null);
  }

  return (
    <div className="space-y-space-md">
      {showComposer && !viewer.isAdmin && <PostComposer name={viewer.name} avatar={viewer.avatar} isOwner={viewer.isOwner} onPosted={(post) => setPosts((list) => [post, ...list])} />}
      {posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts yet" description="Follow or connect with members to see their updates and milestones here. Open loan requests appear here automatically." />
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} viewerId={viewer.id} viewerIsAdmin={viewer.isAdmin} onDeleted={(id) => setPosts((list) => list.filter((p) => p.id !== id))} />)
      )}
      {cursor && (
        <div className="flex justify-center">
          <button type="button" onClick={more} disabled={loading} className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-space-md py-2 text-label-md font-semibold text-primary disabled:opacity-60">
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Load more
          </button>
        </div>
      )}
    </div>
  );
}
