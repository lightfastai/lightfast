import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { env } from "@/env";

const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

export async function GET() {
	try {
		const cutoffTime = Date.now() - 5 * 60 * 1000;
		let cleaned = 0;

		let cursor = "0";
		do {
			const result = await redis.scan(cursor, {
				match: "streams:*:*",
				count: 100,
			});

			cursor = result[0];
			const keys = result[1];

			for (const key of keys) {
				const parts = key.split(":");
				if (parts.length !== 3) continue;

				const [, userId, threadId] = parts;

				const oldStreams = (await redis.zrange(key, 0, cutoffTime - 1, {
					byScore: true,
				})) as string[];

				if (oldStreams.length > 0) {
					await redis.zrem(key, ...oldStreams);

					const keysToDelete = oldStreams.map((id) => `stream:${userId}:${threadId}:${id}`);
					await redis.del(...keysToDelete);

					cleaned += oldStreams.length;
				}
			}
		} while (cursor !== "0");

		return NextResponse.json({ cleaned });
	} catch (error) {
		return NextResponse.json({ error: "Failed" }, { status: 500 });
	}
}
