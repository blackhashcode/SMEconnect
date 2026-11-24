"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, LoaderCircle, MessageSquare, MoreHorizontal, Send, Trash2, Trophy, Wallet, Megaphone, HandCoins } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { formatBDT } from "@/lib/format";
import { tenureLabel } from "@/lib/loans";
import type { components } from "@/lib/backend/schema";
import { ReportButton } from "./ReportButton";

type Post = components["schemas"]["PostRecord"];
type Comment = components["schemas"]["CommentRecord"];

const TYPE = {
  UPDATE: { label: "Update", icon: Megaphone, tone: "bg-primary-fixed text-primary" },
  MILESTONE: { label: "Milestone", icon: Trophy, tone: "bg-tertiary-fixed text-tertiary" },
  LOAN_REQUEST: { label: "Loan request", icon: HandCoins, tone: "bg-secondary-fixed text-secondary" },
  REPAYMENT: { label: "Repayment", icon: Wallet, tone: "bg-success-container text-success" },
} as const;

const profileHref = (role: "OWNER" | "INVESTOR", id: string) => (role === "OWNER" ? `/businesses/${id}` : `/investors/${id}`);

/** One feed post: author, type, content, photos, loan summary, likes, comments, report/delete. */
export function PostCard({ post, viewerId, onDeleted }: { post: Post; viewerId: string; onDeleted?: (id: string) => void }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = TYPE[post.type] ?? TYPE.UPDATE;
  const mine = post.authorId === viewerId;

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const result = next ? await api.post(`/posts/${post.id}/like`) : await api.delete(`/posts/${post.id}/like`);
    if (!result.ok && result.status !== 409) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  async function openComments() {
    setShowComments((v) => !v);
    if (comments === null) {
      const result = await api.get<Comment[]>(`/posts/${post.id}/comments?limit=50`);
      setComments(result.ok ? result.data : []);
    }
  }

  async function addComment() {
    const content = draft.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    const result = await api.post<Comment>(`/posts/${post.id}/comments`, { content });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setComments((list) => [...(list ?? []), result.data]);
    setCommentCount((n) => n + 1);
    setDraft("");
  }

  async function removeComment(id: string) {
    const result = await api.delete(`/posts/${post.id}/comments/${id}`);
    if (result.ok) {
      setComments((list) => (list ?? []).filter((c) => c.id !== id));
      setCommentCount((n) => Math.max(0, n - 1));
    }
  }

  async function removePost() {
    const result = await api.delete(`/posts/${post.id}`);
    if (result.ok) onDeleted?.(post.id);
    else setError(result.error);
  }

  return (
    <article className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow md:p-space-lg">
      <header className="flex items-start gap-space-sm">
        <Link href={profileHref(post.author.role, post.authorId)}>
          <Avatar src={post.author.image ?? ""} alt={post.author.name} name={post.author.name} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={profileHref(post.author.role, post.authorId)} className="text-label-md font-bold text-on-surface hover:text-primary">{post.author.name}</Link>
            {post.author.verified && <VerifiedBadge compact />}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            {post.author.role === "OWNER" ? post.author.shopName ?? "Business owner" : "Investor"} · <TimeAgo iso={post.createdAt} />
          </p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label-sm font-semibold", type.tone)}>
          <type.icon className="h-3.5 w-3.5" aria-hidden /> {type.label}
        </span>
        <div className="relative">
          <button type="button" aria-label="Post options" onClick={() => setMenu((m) => !m)} className="rounded-full p-1.5 text-outline hover:bg-surface-container-high">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
          {menu && (
            <div className="absolute right-0 top-8 z-30 w-72 rounded-2xl border border-surface-container-high bg-surface-container-lowest p-space-sm shadow-card-hover">
              {mine ? (
                <button type="button" onClick={removePost} className="flex items-center gap-1.5 text-body-sm text-error"><Trash2 className="h-4 w-4" aria-hidden /> Delete post</button>
              ) : (
                <ReportButton targetType="POST" targetId={post.id} label="Report post" />
              )}
            </div>
          )}
        </div>
      </header>

      {post.content && <p className="mt-space-sm whitespace-pre-wrap text-body-md text-on-surface">{post.content}</p>}

      {post.imageUrls.length > 0 && (
        <div className={cn("mt-space-sm grid gap-1 overflow-hidden rounded-xl", post.imageUrls.length > 1 && "grid-cols-2")}>
          {post.imageUrls.slice(0, 4).map((src) => (
            <Photo key={src} src={src} alt="" className="aspect-[4/3] w-full" sizes="(min-width: 768px) 320px, 50vw" />
          ))}
        </div>
      )}

      {post.loanRequest && (
        <Link href={`/loan-requests/${post.loanRequest.id}/offer`} className="mt-space-sm grid grid-cols-3 gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-center transition-colors hover:bg-primary-fixed/40">
          <div><p className="text-label-sm text-outline">Requested</p><p className="text-label-md font-bold text-on-surface">{formatBDT(post.loanRequest.amountBdt)}</p></div>
          <div><p className="text-label-sm text-outline">Tenure</p><p className="text-label-md font-bold text-on-surface">{tenureLabel(post.loanRequest.tenureDays)}</p></div>
          <div><p className="text-label-sm text-outline">Rate</p><p className="text-label-md font-bold text-success">{Number(post.loanRequest.proposedRatePct)}% p.a.</p></div>
        </Link>
      )}

      <footer className="mt-space-sm flex items-center gap-space-md border-t border-surface-container-high pt-space-sm">
        <button type="button" onClick={toggleLike} aria-pressed={liked} className={cn("inline-flex items-center gap-1.5 text-label-md", liked ? "font-bold text-secondary" : "text-on-surface-variant hover:text-secondary")}>
          <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden /> {likes > 0 ? likes : ""} Like{likes === 1 || likes === 0 ? "" : "s"}
        </button>
        <button type="button" onClick={openComments} aria-expanded={showComments} className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant hover:text-primary">
          <MessageSquare className="h-4 w-4" aria-hidden /> {commentCount > 0 ? commentCount : ""} Comment{commentCount === 1 || commentCount === 0 ? "" : "s"}
        </button>
      </footer>

      {showComments && (
        <div className="mt-space-sm space-y-space-sm">
          {comments === null ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-outline" aria-hidden />
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-space-sm">
                <Link href={profileHref(c.author.role, c.authorId)}><Avatar src={c.author.image ?? ""} alt={c.author.name} name={c.author.name} size="sm" /></Link>
                <div className="min-w-0 flex-1 rounded-xl bg-surface-container-low px-space-sm py-1.5">
                  <div className="flex items-center gap-2">
                    <Link href={profileHref(c.author.role, c.authorId)} className="text-label-md font-bold text-on-surface hover:text-primary">{c.author.name}</Link>
                    <TimeAgo iso={c.createdAt} className="text-label-sm text-outline" />
                    <span className="ml-auto">
                      {c.authorId === viewerId ? (
                        <button type="button" aria-label="Delete comment" onClick={() => removeComment(c.id)} className="text-outline hover:text-error"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                      ) : (
                        <ReportButton targetType="COMMENT" targetId={c.id} label="" className="text-outline" />
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-body-sm text-on-surface">{c.content}</p>
                </div>
              </div>
            ))
          )}
          <div className="flex gap-space-sm">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addComment()} maxLength={2000} placeholder="Write a comment…" aria-label="Write a comment" className="h-10 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-space-md text-body-sm focus:border-primary focus:outline-none" />
            <button type="button" onClick={addComment} disabled={busy || !draft.trim()} aria-label="Post comment" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-space-sm text-body-sm text-error">{error}</p>}
    </article>
  );
}
