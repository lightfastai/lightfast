#!/usr/bin/env tsx
/**
 * Reset Database Script
 *
 * Drops all existing tables in the Deus database and recreates them with the new schema.
 * Use with caution - this will delete ALL data!
 */

import { db } from "../src/client";
import { sql } from "drizzle-orm";

async function resetDatabase() {
	console.log("🔥 Dropping all existing tables...");

	try {
		// Disable foreign key checks
		await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);

		// Drop all tables
		const tables = [
			"lightfast_deus_organizations",
			"lightfast_deus_organization_members",
			"lightfast_deus_connected_repository",
			"lightfast_deus_code_reviews",
			"lightfast_deus_code_review_tasks",
		];

		for (const table of tables) {
			try {
				await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table}`));
				console.log(`✅ Dropped table: ${table}`);
			} catch (error) {
				console.log(`⚠️  Failed to drop ${table}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		// Re-enable foreign key checks
		await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

		console.log("✅ All tables dropped successfully!");
		console.log("👉 Now run: pnpm db:push");
	} catch (error) {
		console.error("❌ Error resetting database:", error);
		process.exit(1);
	}
}

resetDatabase()
	.then(() => {
		console.log("✅ Database reset complete");
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Failed to reset database:", error);
		process.exit(1);
	});
