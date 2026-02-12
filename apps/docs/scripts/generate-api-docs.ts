#!/usr/bin/env tsx

import { execSync } from "node:child_process";

async function main() {
  console.log("Generating OpenAPI spec from Zod schemas...");
  try {
    execSync("pnpm --filter @repo/console-openapi generate:openapi", {
      stdio: "inherit",
      cwd: process.cwd() + "/../..",
    });
    console.log("✅ OpenAPI spec generated successfully!");
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }

  console.log("\n✅ Using openapiSource virtual pages for API endpoints (no MDX generation needed)");
}

main();

