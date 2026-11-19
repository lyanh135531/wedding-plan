import { defineConfig } from "drizzle-kit";
import { createRequire } from "node:module";
import path from "node:path";

// Reuse Next's environment loader so CLI migrations use .env.local as the app does.
const projectRequire = createRequire(path.resolve("package.json"));
const nextRequire = createRequire(projectRequire.resolve("next/package.json"));
nextRequire("@next/env").loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Configure .env.local or the process environment before running Drizzle.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
