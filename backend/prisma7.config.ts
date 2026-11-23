import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI only (migrate/seed/studio). Hosted Postgres poolers (e.g. Neon's "-pooler"
    // host) don't suit migrations, so DIRECT_URL can point at the direct host.
    // The running app always uses DATABASE_URL (src/server/db.ts).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
