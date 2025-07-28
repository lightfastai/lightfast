/**
 * API route to start LLM stream generation
 * POST /api/v2/generate
 */

import { StreamGenerator } from "@lightfast/ai/v2/server";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { GatewayGPT4Nano } from "@lightfast/ai/providers";
import { env } from "@/env";

// Initialize Redis
const redis = new Redis({
	url: env.KV_REST_API_URL,
	token: env.KV_REST_API_TOKEN,
});

// Initialize stream generator
const generator = new StreamGenerator(redis);

export async function POST(req: NextRequest) {
	try {
		const { prompt, sessionId: providedSessionId } = await req.json();

		if (!prompt) {
			return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
		}

		// Use provided session ID or generate new one
		const sessionId = providedSessionId || generator.createSessionId();

		// Check if stream already exists
		const exists = await generator.streamExists(sessionId);
		if (exists) {
			return NextResponse.json(
				{ error: "Stream already exists", sessionId },
				{ status: 409 },
			);
		}

		// Start generation in background (don't await)
		generator.generate(
			sessionId,
			prompt,
			GatewayGPT4Nano(), // Using GPT 4.1 Nano from Vercel AI Gateway
		).catch((error) => {
			console.error(`Stream generation error for ${sessionId}:`, error);
		});

		// Return session ID immediately
		return NextResponse.json({
			sessionId,
			streamUrl: `/api/v2/stream/${sessionId}`,
		});
	} catch (error) {
		console.error("Generate error:", error);
		return NextResponse.json(
			{ error: "Failed to start generation" },
			{ status: 500 },
		);
	}
}

// GET endpoint to check stream status
export async function GET(req: NextRequest) {
	try {
		const sessionId = req.nextUrl.searchParams.get("sessionId");
		
		if (!sessionId) {
			return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
		}

		const info = await generator.getStreamInfo(sessionId);

		return NextResponse.json(info);
	} catch (error) {
		console.error("Stream info error:", error);
		return NextResponse.json(
			{ error: "Failed to get stream info" },
			{ status: 500 },
		);
	}
}