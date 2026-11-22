import { AppShell } from "@/components/layout/AppShell";
import { ExploreBrowser } from "@/components/domain/ExploreBrowser";

export const metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <AppShell>
      <ExploreBrowser />
    </AppShell>
  );
}
