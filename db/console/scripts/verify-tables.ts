/**
 * Verify that jobs and metrics tables exist
 */

import { sql } from "drizzle-orm";
import { db } from "../src/client";

async function verifyTables() {
	console.log("Verifying tables exist...\n");

	try {
		// Check if lightfast_jobs exists and get count
		const [jobsResult] = await db.execute(sql`
			SELECT COUNT(*) as count FROM lightfast_jobs;
		`);
		console.log(`✓ lightfast_jobs table exists (${jobsResult.count} rows)`);

		// Check if lightfast_metrics exists and get count
		const [metricsResult] = await db.execute(sql`
			SELECT COUNT(*) as count FROM lightfast_metrics;
		`);
		console.log(`✓ lightfast_metrics table exists (${metricsResult.count} rows)`);

		// Check if lightfast_api_keys exists and get count
		const [apiKeysResult] = await db.execute(sql`
			SELECT COUNT(*) as count FROM lightfast_api_keys;
		`);
		console.log(`✓ lightfast_api_keys table exists (${apiKeysResult.count} rows)`);

		// List all indexes on jobs table
		const jobsIndexes = await db.execute(sql`
			SELECT indexname FROM pg_indexes
			WHERE tablename = 'lightfast_jobs'
			ORDER BY indexname;
		`);
		console.log(`\n✓ lightfast_jobs has ${jobsIndexes.length} indexes:`);
		jobsIndexes.forEach((idx: any) => {
			console.log(`  - ${idx.indexname}`);
		});

		// List all indexes on metrics table
		const metricsIndexes = await db.execute(sql`
			SELECT indexname FROM pg_indexes
			WHERE tablename = 'lightfast_metrics'
			ORDER BY indexname;
		`);
		console.log(`\n✓ lightfast_metrics has ${metricsIndexes.length} indexes:`);
		metricsIndexes.forEach((idx: any) => {
			console.log(`  - ${idx.indexname}`);
		});

		console.log("\n✅ All tables and indexes verified successfully!");
	} catch (error) {
		console.error("\n❌ Verification failed:", error);
		throw error;
	}
}

// Run verification
verifyTables()
	.then(() => {
		console.log("\nDone!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\nFailed:", error);
		process.exit(1);
	});
