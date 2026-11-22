"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-margin text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error">
        <TriangleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-space-lg text-headline-md text-on-surface">Something went wrong</h1>
      <p className="mt-space-sm max-w-md text-body-md text-on-surface-variant">
        This page hit an unexpected error. Try again, or head back to your feed.
      </p>
      <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/feed" variant="outline">
          Go to feed
        </LinkButton>
      </div>
    </div>
  );
}
