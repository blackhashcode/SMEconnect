"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Star } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/format";

/**
 * After a loan is completed, each side can rate the other once (1–5 stars and
 * an optional comment). Reviews feed the trust score shown on profiles.
 */
export function ReviewForm({ loanId, completed, reviewee }: { loanId: string; completed: boolean; reviewee: { id: string; name: string } }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"loading" | "open" | "busy" | "done">("loading");
  const [error, setError] = useState<string | null>(null);
  const short = firstName(reviewee.name);

  // Already reviewed? Then show the thank-you state straight away.
  useEffect(() => {
    let alive = true;
    void api.get<{ loanId?: string; reviewer?: { id?: string } }[]>(`/reviews?userId=${encodeURIComponent(reviewee.id)}&limit=50`).then((r) => {
      if (!alive) return;
      const mine = r.ok && r.data.some((review) => review.loanId === loanId);
      setState(mine ? "done" : "open");
    });
    return () => {
      alive = false;
    };
  }, [loanId, reviewee.id]);

  if (!completed) {
    return <p className="text-body-sm text-on-surface-variant">Once the loan is fully repaid you&apos;ll both be able to leave a review for each other.</p>;
  }
  if (state === "loading") return <LoaderCircle className="h-4 w-4 animate-spin text-outline" aria-hidden />;
  if (state === "done") return <p className="text-body-sm font-semibold text-success">Thanks, your review of {short} is on their profile.</p>;

  async function submit() {
    if (!rating) return setError("Choose a star rating.");
    setState("busy");
    setError(null);
    const result = await api.post("/reviews", { loanId, revieweeId: reviewee.id, rating, comment: comment.trim() || undefined });
    if (!result.ok) {
      setState(result.status === 409 ? "done" : "open");
      if (result.status !== 409) setError(result.error);
      return;
    }
    setState("done");
  }

  return (
    <div className="space-y-space-sm">
      <p className="text-label-md font-semibold text-on-surface">How was it working with {short}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5">
            <Star className={cn("h-7 w-7 transition-colors", (hover || rating) >= n ? "fill-warning text-warning" : "text-outline-variant")} aria-hidden />
          </button>
        ))}
      </div>
      <textarea rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={`Share what went well (optional). This appears on ${short}'s profile.`} aria-label="Review comment" className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-2 text-body-sm focus:border-primary focus:outline-none" />
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <button type="button" onClick={submit} disabled={state === "busy"} className="inline-flex items-center gap-1 rounded-xl bg-primary px-space-md py-2 text-label-md font-semibold text-on-primary disabled:opacity-60">
        {state === "busy" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Post review
      </button>
    </div>
  );
}
