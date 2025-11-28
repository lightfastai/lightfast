/**
 * Mark migration 0001 as applied in Drizzle migrations table
 */

import { sql } from "drizzle-orm";
import { db } from "../src/client";

async function markMigrationApplied() {
	console.log("Marking migration 0001_moaning_tyger_tiger as applied...");

	try {
		// Check if __drizzle_migrations table exists
		const tables = await db.execute(sql`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'drizzle'
			AND table_name = '__drizzle_migrations';
		`);

		if (tables.length === 0) {
			console.log("Creating drizzle schema and __drizzle_migrations table...");
			await db.execute(sql`
				CREATE SCHEMA IF NOT EXISTS drizzle;
			`);
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
					id SERIAL PRIMARY KEY,
					hash text NOT NULL,
					created_at bigint
				);
			`);
		}

		// Check if migration is already recorded
		const existing = await db.execute(sql`
			SELECT * FROM drizzle.__drizzle_migrations
			WHERE hash = '0001_moaning_tyger_tiger';
		`);

		if (existing.length > 0) {
			console.log("✓ Migration 0001 is already marked as applied");
		} else {
			// Insert migration record
			await db.execute(sql`
				INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
				VALUES ('0001_moaning_tyger_tiger', ${Date.now()});
			`);
			console.log("✓ Migration 0001 marked as applied");
		}

		// Show all applied migrations
		const allMigrations = await db.execute(sql`
			SELECT hash, created_at FROM drizzle.__drizzle_migrations
			ORDER BY created_at;
		`);

		console.log("\nApplied migrations:");
		allMigrations.forEach((m: any) => {
			const date = new Date(Number(m.created_at));
			console.log(`  - ${m.hash} (${date.toISOString()})`);
		});

		console.log("\n✅ Migration tracking updated successfully!");
	} catch (error) {
		console.error("\n❌ Failed:", error);
		throw error;
	}
}

// Run
markMigrationApplied()
	.then(() => {
		console.log("\nDone!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\nFailed:", error);
		process.exit(1);
	});
