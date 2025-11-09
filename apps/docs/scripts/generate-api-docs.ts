#!/usr/bin/env tsx

import { generateFiles } from "fumadocs-openapi";
import { openapi } from "../src/lib/openapi";
import path from "node:path";

async function main() {
	console.log("Generating API documentation from OpenAPI spec...");

	try {
		await generateFiles({
			input: openapi,
			output: "./src/content/api",
			includeDescription: true,
			groupBy: "tag",
		});

		console.log("✅ API documentation generated successfully!");
	} catch (error) {
		console.error("❌ Failed to generate API documentation:", error);
		process.exit(1);
	}
}

main();