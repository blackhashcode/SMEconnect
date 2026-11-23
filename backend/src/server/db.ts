import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Each server instance holds its own pool; the provider's pooler (e.g. Neon's
// -pooler host) multiplexes them. The bot test (scripts/bots.mjs) showed 5 was a
// bottleneck under concurrent load and 10-15 removed it.
const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : 10,
  idleTimeoutMillis: 10_000,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Single Prisma client instance for the whole app. */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
