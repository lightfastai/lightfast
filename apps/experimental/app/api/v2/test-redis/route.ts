import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { env } from "@/env";

const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

export async function GET() {
	try {
		// First check if Redis is configured
		if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
			return NextResponse.json({
				error: "Redis not configured",
				url: !!env.KV_REST_API_URL,
				token: !!env.KV_REST_API_TOKEN,
			}, { status: 500 });
		}
		
		const testKey = "test:stream";
		
		// Test basic xadd - Upstash expects an object
		const result1 = await redis.xadd(testKey, "*", { field1: "value1", field2: "value2" });
		console.log("xadd result:", result1);
		
		// Test xadd with different field types
		const testFields = {
			type: "metadata",
			status: "started",
			sessionId: "123456",
			timestamp: new Date().toISOString(),
		};
		const result3 = await redis.xadd(testKey, "*", testFields);
		console.log("xadd with metadata result:", result3);
		
		// Test xgroup creation
		let xgroupResult;
		try {
			xgroupResult = await (redis as any).xgroup("CREATE", testKey, "mygroup", "$", "MKSTREAM");
			console.log("xgroup result:", xgroupResult);
		} catch (e: any) {
			console.log("xgroup error:", e.message);
			xgroupResult = { error: e.message };
		}
		
		// Test xrange
		const result2 = await redis.xrange(testKey, "-", "+");
		console.log("xrange result:", result2);
		
		// Clean up
		await redis.del(testKey);
		
		return NextResponse.json({
			success: true,
			xaddResult: result1,
			xaddMetadataResult: result3,
			xgroupResult,
			xrangeResult: result2,
			xrangeType: typeof result2,
			isArray: Array.isArray(result2),
		});
	} catch (error) {
		console.error("Redis test error:", error);
		return NextResponse.json({
			error: error instanceof Error ? error.message : "Unknown error",
			stack: error instanceof Error ? error.stack : undefined,
		}, { status: 500 });
	}
}