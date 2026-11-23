import { ExploreBrowser } from "@/components/domain/ExploreBrowser";
import { listBusinesses, listInvestors, listOpenLoanRequests } from "@/lib/api";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const [directory, investors, loans] = await Promise.all([listBusinesses(), listInvestors(), listOpenLoanRequests()]);
  return (
    <ExploreBrowser
      businesses={directory.map((entry) => entry.business)}
      people={[...investors, ...directory.map((entry) => entry.owner)]}
      loans={loans}
    />
  );
}
