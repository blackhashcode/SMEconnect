import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";
import { AdminAction } from "@/components/admin/AdminAction";
import { AdminTable, Cell, NextPage, StatusBadge, dateTime } from "@/components/admin/AdminTable";
import { adminComments, adminPosts } from "@/lib/admin";
import { cn } from "@/lib/cn";

export const metadata = { title: "Content · Admin" };

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ view?: string; cursor?: string }> }) {
  const params = await searchParams;
  const view = params.view === "comments" ? "comments" : "posts";
  const posts = view === "posts" ? await adminPosts(params.cursor) : null;
  const comments = view === "comments" ? await adminComments(params.cursor) : null;

  return (
    <div className="space-y-space-md">
      <div className="flex gap-space-sm border-b border-surface-container-high">
        {[{ key: "posts", label: "Posts" }, { key: "comments", label: "Comments" }].map((tab) => (
          <Link key={tab.key} href={tab.key === "comments" ? "/admin/content?view=comments" : "/admin/content"} className={cn("-mb-px border-b-2 px-space-md py-2 text-label-md font-semibold", view === tab.key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
            {tab.label}
          </Link>
        ))}
      </div>

      {posts && (
        <>
          <AdminTable head={["Post", "Type", "Author", "Posted", ""]} empty={posts.items.length === 0}>
            {posts.items.map((post) => (
              <tr key={post.id}>
                <Cell className="max-w-[420px] whitespace-pre-wrap">{post.content}</Cell>
                <Cell><StatusBadge status={post.type} /></Cell>
                <Cell><Link href={`/admin/users/${post.authorId}`} className="text-primary hover:underline">View author</Link></Cell>
                <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(post.createdAt)}</Cell>
                <Cell>
                  {post.deletedAt ? (
                    <AdminAction endpoint={`/admin/posts/${post.id}/restore`} label="Restore" variant="ghost" confirm="Restore this post (and the comments removed with it)?" icon={<RotateCcw className="h-4 w-4" aria-hidden />} />
                  ) : (
                    <AdminAction endpoint={`/admin/posts/${post.id}`} method="DELETE" label="Remove" variant="ghost" confirm="Remove this post and its comments from the feed?" icon={<Trash2 className="h-4 w-4" aria-hidden />} />
                  )}
                </Cell>
              </tr>
            ))}
          </AdminTable>
          <NextPage base="/admin/content" cursor={posts.nextCursor} />
        </>
      )}

      {comments && (
        <>
          <AdminTable head={["Comment", "Author", "Posted", ""]} empty={comments.items.length === 0}>
            {comments.items.map((comment) => (
              <tr key={comment.id}>
                <Cell className="max-w-[460px] whitespace-pre-wrap">{comment.content}</Cell>
                <Cell><Link href={`/admin/users/${comment.authorId}`} className="text-primary hover:underline">View author</Link></Cell>
                <Cell className="whitespace-nowrap text-on-surface-variant">{dateTime(comment.createdAt)}</Cell>
                <Cell>
                  {comment.deletedAt ? (
                    <AdminAction endpoint={`/admin/comments/${comment.id}/restore`} label="Restore" variant="ghost" confirm="Restore this comment?" icon={<RotateCcw className="h-4 w-4" aria-hidden />} />
                  ) : (
                    <AdminAction endpoint={`/admin/comments/${comment.id}`} method="DELETE" label="Remove" variant="ghost" confirm="Remove this comment?" icon={<Trash2 className="h-4 w-4" aria-hidden />} />
                  )}
                </Cell>
              </tr>
            ))}
          </AdminTable>
          <NextPage base="/admin/content" cursor={comments.nextCursor} params={{ view: "comments" }} />
        </>
      )}
    </div>
  );
}
