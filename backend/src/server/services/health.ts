import { prisma } from "@/server/db";
import { DatabaseUnavailableError } from "@/server/errors";

export interface HealthStatus {
  status: "ok";
  database: "connected";
  timestamp: string;
}

/** Checks that the configured PostgreSQL database is reachable. */
export async function getHealthStatus(): Promise<HealthStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  } catch {
    throw new DatabaseUnavailableError();
  }
}
