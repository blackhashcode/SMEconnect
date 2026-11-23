"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, ImageIcon, Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ViewerDocument = { label: string; href: string };

const isPdf = (href: string) => /\.pdf(?:$|\?)/i.test(href);

/**
 * Document chips that open in a viewer inside the admin panel: images inline
 * (with fit / actual size), PDFs in the browser's PDF reader. Nothing is
 * downloaded, and each opening is recorded in the activity log by the backend.
 */
export function DocumentViewer({ documents, className }: { documents: ViewerDocument[]; className?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const [actualSize, setActualSize] = useState(false);
  const current = index === null ? null : documents[index];

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowRight") setIndex((i) => (i === null ? i : Math.min(documents.length - 1, i + 1)));
      if (event.key === "ArrowLeft") setIndex((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, documents.length]);

  return (
    <>
      <div className={cn("flex flex-wrap gap-space-sm", className)}>
        {documents.map((doc, i) => (
          <button
            key={doc.href}
            type="button"
            onClick={() => { setActualSize(false); setIndex(i); }}
            className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-space-md py-1.5 text-body-sm font-medium text-on-surface-variant transition-colors hover:bg-primary-fixed hover:text-primary"
          >
            {isPdf(doc.href) ? <FileText className="h-3.5 w-3.5" aria-hidden /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden />} {doc.label}
          </button>
        ))}
      </div>

      {current &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={current.label} className="fixed inset-0 z-[100] flex flex-col bg-inverse-surface/90 backdrop-blur-sm" onClick={() => setIndex(null)}>
            <div className="flex items-center gap-space-sm px-space-md py-space-sm text-inverse-on-surface" onClick={(event) => event.stopPropagation()}>
              <p className="flex-1 truncate text-label-md font-semibold">
                {current.label}
                {documents.length > 1 && <span className="ml-2 font-normal opacity-70">{index! + 1} of {documents.length}</span>}
              </p>
              {documents.length > 1 && (
                <>
                  <button type="button" className="rounded-lg px-3 py-1.5 text-label-md hover:bg-white/10 disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(index! - 1)}>Previous</button>
                  <button type="button" className="rounded-lg px-3 py-1.5 text-label-md hover:bg-white/10 disabled:opacity-40" disabled={index === documents.length - 1} onClick={() => setIndex(index! + 1)}>Next</button>
                </>
              )}
              {!isPdf(current.href) && (
                <button type="button" aria-label={actualSize ? "Fit to screen" : "Actual size"} className="rounded-lg p-2 hover:bg-white/10" onClick={() => setActualSize((v) => !v)}>
                  {actualSize ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
                </button>
              )}
              <a href={current.href} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab" className="rounded-lg p-2 hover:bg-white/10">
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <button type="button" aria-label="Close" className="rounded-lg p-2 hover:bg-white/10" onClick={() => setIndex(null)}>
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className={cn("flex flex-1 justify-center p-space-md", actualSize ? "items-start overflow-auto" : "items-center overflow-hidden")} onClick={(event) => event.stopPropagation()}>
              {isPdf(current.href) ? (
                <iframe key={current.href} src={current.href} title={current.label} className="h-full w-full max-w-5xl rounded-lg bg-white" />
              ) : (
                // Private, authenticated files: next/image can't optimise them, so a plain img is right here.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={current.href} src={current.href} alt={current.label} className={cn("rounded-lg bg-white shadow-2xl", actualSize ? "max-w-none" : "max-h-full max-w-full object-contain")} />
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
