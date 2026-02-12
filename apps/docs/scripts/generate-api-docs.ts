#!/usr/bin/env tsx

import { generateFiles } from "fumadocs-openapi";
import { openapi } from "../src/lib/openapi";
import { execSync } from "node:child_process";

async function main() {
  console.log("Step 1: Generating OpenAPI spec from Zod schemas...");
  try {
    execSync("pnpm --filter @repo/console-openapi generate:openapi", {
      stdio: "inherit",
      cwd: process.cwd() + "/../..",
    });
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI spec:", error);
    process.exit(1);
  }

  console.log("\nStep 2: Generating API documentation from OpenAPI spec...");
  try {
    await generateFiles({
      input: openapi,
      output: "./src/content/api/endpoints",
      includeDescription: true,
      groupBy: "tag",
      per: "operation",
      frontmatter: (title, description) => ({
        title,
        description,
        full: true,
      }),
    });

    console.log("✅ API documentation generated successfully!");
  } catch (error) {
    console.error("❌ Failed to generate API documentation:", error);
    process.exit(1);
  }
}

main();

