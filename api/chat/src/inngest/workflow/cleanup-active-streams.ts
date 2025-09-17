import { inngest } from "../client/client";
import { db } from "@db/chat/client";
import { LightfastChatSession } from "@db/chat";
import { and, sql, lt } from "drizzle-orm";

export const cleanupActiveStreams = inngest.createFunction(
	{
		id: "apps-chat.cleanup-active-streams",
		name: "Cleanup Old Active Streams",
		retries: 2,
	},
	{ cron: "*/5 * * * *" }, // Run every 5 minutes
	async ({ step }) => {
		// Step 1: Calculate cutoff time (5 minutes ago)
		const cutoffTime = new Date(Date.now() - 5 * 60 * 1000);

		// Step 2: Clear old active stream IDs
		const result = await step.run("cleanup-streams", async () => {
			const updateResult = await db
				.update(LightfastChatSession)
				.set({ activeStreamId: null })
				.where(
					and(
						sql`${LightfastChatSession.activeStreamId} IS NOT NULL`,
						lt(LightfastChatSession.updatedAt, cutoffTime),
					),
				);

			return {
				clearedCount: updateResult.rowsAffected || 0,
				cutoffTime: cutoffTime.toISOString(),
			};
		});

		console.log(`[ActiveStreamCleanup] Cleared ${result.clearedCount} active streams older than 5 minutes`);

		return {
			success: true,
			...result,
		};
	},
);