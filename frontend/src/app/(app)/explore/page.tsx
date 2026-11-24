import { ExploreBrowser } from "@/components/domain/ExploreBrowser";
import { listBusinesses, listInvestors, listOpenLoanRequests } from "@/lib/api";

export const metadata = { title: "Explore" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [directory, investors, loans] = await Promise.all([listBusinesses(), listInvestors(), listOpenLoanRequests()]);
  return (
    <ExploreBrowser
      businesses={directory.map((entry) => entry.business)}
      people={[...investors, ...directory.map((entry) => entry.owner)]}
      loans={loans}
      initialQuery={q?.slice(0, 100) ?? ""}
    />
  );
}
