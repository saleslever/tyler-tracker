import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://tyler:tyler@localhost:5432/tyler_tracker",
  },
});
