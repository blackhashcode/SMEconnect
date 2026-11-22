import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each page eases in instead of popping. */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
