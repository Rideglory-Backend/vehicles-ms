// Prisma ORM 7: SQLite URL lives here (not in schema.prisma).
// See https://www.prisma.io/docs/orm/core-concepts/supported-databases/sqlite
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Same value the app passes to PrismaBetterSqlite3 (e.g. file:./dev.db)
    url: env("DATABASE_URL"),
  },
});
