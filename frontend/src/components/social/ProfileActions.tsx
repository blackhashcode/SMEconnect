"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ban, Check, LoaderCircle, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/client-api";
import { firstName } from "@/lib/format";
import { ReportButton } from "./ReportButton";

/** Follow / Following plus a "more" menu with Report and Block for another member's profile. */
export function ProfileActions({ userId, name, following: initialFollowing, blocked: initialBlocked }: { userId: string; name: string; following: boolean; blocked: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const short = firstName(name);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => box.current && !box.current.contains(event.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function toggleFollow() {
    setBusy(true);
    setError(null);
    const result = following ? await api.delete(`/follows/${userId}`) : await api.post("/follows", { followeeId: userId });
    setBusy(false);
    if (!result.ok && result.status !== 409) return setError(result.error);
    setFollowing(!following);
  }

  async function toggleBlock() {
    setBusy(true);
    setError(null);
    const result = blocked ? await api.delete(`/blocks/${userId}`) : await api.post("/blocks", { userId });
    setBusy(false);
    setConfirmBlock(false);
    setMenu(false);
    if (!result.ok && result.status !== 409) return setError(result.error);
    setBlocked(!blocked);
    if (!blocked) setFollowing(false);
    router.refresh();
  }

  return (
    <span className="relative inline-flex flex-col" ref={box}>
      <span className="inline-flex gap-space-sm">
        {!blocked && (
          <Button variant={following ? "soft" : "outline"} onClick={toggleFollow} disabled={busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : following ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {following ? "Following" : "Follow"}
          </Button>
        )}
        {blocked && (
          <Button variant="outline" onClick={toggleBlock} disabled={busy}>
            <Ban className="h-4 w-4" aria-hidden /> Unblock {short}
          </Button>
        )}
        <Button variant="ghost" aria-label="More options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <MoreHorizontal className="h-5 w-5" aria-hidden />
        </Button>
      </span>
      {menu && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-space-sm rounded-2xl border border-surface-container-high bg-surface-container-lowest p-space-md shadow-card-hover">
          <ReportButton targetType="USER" targetId={userId} label={`Report ${short}`} className="w-full py-1 text-body-md text-on-surface sm:w-full" />
          {!blocked && !confirmBlock && (
            <button type="button" onClick={() => setConfirmBlock(true)} className="flex w-full items-center gap-1.5 py-1 text-body-md text-on-surface hover:text-error">
              <Ban className="h-4 w-4" aria-hidden /> Block {short}
            </button>
          )}
          {confirmBlock && (
            <div className="space-y-space-sm rounded-xl bg-surface-container-low p-space-sm">
              <p className="text-body-sm text-on-surface">Block {short}? You won&apos;t be able to message or connect with each other, and any connection between you ends.</p>
              <div className="flex gap-space-sm">
                <button type="button" onClick={toggleBlock} disabled={busy} className="rounded-lg bg-error px-3 py-1.5 text-label-md font-semibold text-on-error">Block</button>
                <button type="button" onClick={() => setConfirmBlock(false)} className="rounded-lg px-3 py-1.5 text-label-md text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <span role="alert" className="mt-1 text-body-sm text-error">{error}</span>}
    </span>
  );
}
