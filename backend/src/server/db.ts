import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

function createClient(): PrismaClient {
  // Each server instance holds its own pool; the provider's pooler (Neon's
  // -pooler host) multiplexes them. The bot test (scripts/bots.mjs) showed 5 was
  // a bottleneck under concurrent load and 10-15 removed it.
  const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : 10,
    idleTimeoutMillis: 10_000,
  });
  // On Vercel Fluid compute, lets idle connections close before an instance is
  // suspended (recommended by Neon). Does nothing anywhere else.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Single Prisma client instance for the whole app. */
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
