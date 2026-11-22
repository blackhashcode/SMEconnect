import type { Connection } from "./types";

export const connections: Connection[] = [
  { id: "cn-1", personId: "nusrat", businessId: "crave-co", note: "Connected after the Dhanmondi food meetup", createdAt: "3 days ago", state: "connected" },
  { id: "cn-2", personId: "tanvir", businessId: "deshi-threads", note: "Met through Deshi Threads", createdAt: "5 days ago", state: "connected" },
  { id: "cn-3", personId: "farzana", businessId: "terracotta-studio", note: "Shared ceramics supplier", createdAt: "1 week ago", state: "connected" },
  { id: "cn-4", personId: "arif", businessId: "greenline-cargo", note: "Fleet expansion conversation", createdAt: "1 week ago", state: "connected" },
  { id: "cn-5", personId: "samira", note: "Co-investor in two local businesses", createdAt: "2 weeks ago", state: "connected" },
  { id: "cn-6", personId: "tanzeem", note: "Connected over logistics deal", createdAt: "2 weeks ago", state: "connected" },
  { id: "cn-7", personId: "sabrina", businessId: "bella-organics", note: "Introduction from Nusrat", createdAt: "3 weeks ago", state: "pending" },
];

export const connectedBusinesses = connections.filter((connection) => connection.businessId && connection.state === "connected");
