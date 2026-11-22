"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades its children up when they scroll into view. One shared observer for
 * the whole page; each element is unobserved after it appears.
 */
let observer: IntersectionObserver | null = null;

function getObserver() {
  if (observer || typeof window === "undefined") return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );
  return observer;
}

export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
  id,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    const io = getObserver();
    if (!el || !io) return;
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
