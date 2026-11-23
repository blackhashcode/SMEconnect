import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Each serverless instance holds its own pool, so keep it small and let the
// provider's pooler (e.g. Neon's -pooler host) multiplex connections.
const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : 5,
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
