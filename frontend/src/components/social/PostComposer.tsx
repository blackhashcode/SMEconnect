"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Megaphone, Trophy, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/image-compress";
import type { components } from "@/lib/backend/schema";
import type { UploadedFile } from "@/data/types";

type Post = components["schemas"]["PostRecord"];

/** Write a business update or share a milestone, with up to 4 photos. */
export function PostComposer({ name, avatar, isOwner, onPosted }: { name: string; avatar: string; isOwner: boolean; onPosted: (post: Post) => void }) {
  const [type, setType] = useState<"UPDATE" | "MILESTONE">("UPDATE");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<"upload" | "post" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addImage(file: File | undefined) {
    if (!file || images.length >= 4) return;
    setBusy("upload");
    setError(null);
    const form = new FormData();
    form.append("purpose", "PRODUCT_IMAGE");
    form.append("file", await compressImage(file));
    const result = await api.upload<UploadedFile>("/uploads", form);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setImages((list) => [...list, result.data.url]);
  }

  async function submit() {
    if (!content.trim()) return setError(type === "MILESTONE" ? "Describe your milestone." : "Write something to share.");
    setBusy("post");
    setError(null);
    const result = await api.post<Post>("/posts", { type, content: content.trim(), imageUrls: images });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setContent("");
    setImages([]);
    onPosted(result.data);
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-space-md card-shadow">
      <div className="flex gap-space-sm">
        <Avatar src={avatar} alt={name} name={name} size="md" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder={type === "MILESTONE" ? "Share an achievement, e.g. \"We delivered our 1,000th order!\"" : isOwner ? "Share a business update with investors…" : "Share an update with your network…"}
          aria-label="Write a post"
          className="min-h-[64px] flex-1 resize-y rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-2 text-body-md focus:border-primary focus:outline-none"
        />
      </div>
      {images.length > 0 && (
        <div className="mt-space-sm flex flex-wrap gap-space-sm pl-14">
          {images.map((src) => (
            <span key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setImages((l) => l.filter((s) => s !== src))} className="absolute -right-1.5 -top-1.5 rounded-full bg-inverse-surface p-0.5 text-inverse-on-surface"><X className="h-3 w-3" aria-hidden /></button>
            </span>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-space-sm pl-14 text-body-sm text-error">{error}</p>}
      <div className="mt-space-sm flex flex-wrap items-center gap-space-sm pl-14">
        {(["UPDATE", "MILESTONE"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-label-md", type === t ? "border-primary bg-primary-fixed font-bold text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary")}>
            {t === "UPDATE" ? <Megaphone className="h-3.5 w-3.5" aria-hidden /> : <Trophy className="h-3.5 w-3.5" aria-hidden />} {t === "UPDATE" ? "Update" : "Milestone"}
          </button>
        ))}
        <label className={cn("inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-label-md text-on-surface-variant hover:bg-surface-container-high", images.length >= 4 && "pointer-events-none opacity-50")}>
          {busy === "upload" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />} Photo
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => addImage(e.target.files?.[0])} disabled={busy !== null} />
        </label>
        <button type="button" onClick={submit} disabled={busy !== null} className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-space-md py-1.5 text-label-md font-semibold text-on-primary disabled:opacity-60">
          {busy === "post" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Post
        </button>
      </div>
    </div>
  );
}
