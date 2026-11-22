import { ExploreBrowser } from "@/components/domain/ExploreBrowser";
import { listBusinesses, listLoans, listPeople } from "@/lib/api";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const [businesses, people, loans] = await Promise.all([listBusinesses(), listPeople(), listLoans({ status: "active" })]);
  return <ExploreBrowser businesses={businesses} people={people} loans={loans} />;
}
