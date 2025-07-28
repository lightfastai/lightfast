/**
 * DEPRECATED: This endpoint has been replaced by /api/v2/stream/init
 *
 * This file exists for backward compatibility and redirects to the new endpoint.
 * The new endpoint implements the event-driven architecture for agent loops.
 */

import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v2/generate - Redirects to /api/v2/stream/init
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// Transform old format to new format
		const { prompt, sessionId } = body;

		// Create messages array from prompt
		const messages = [{ role: "user" as const, content: prompt || "" }];

		// Forward to new endpoint
		const response = await fetch(new URL("/api/v2/stream/init", req.url), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages,
				sessionId,
				// Default values for new fields
				temperature: 0.7,
				maxIterations: 10,
				tools: [],
			}),
		});

		const data = await response.json();

		// Add deprecation warning to response
		if (response.ok) {
			return NextResponse.json({
				...data,
				_deprecated: "This endpoint is deprecated. Please use /api/v2/stream/init instead.",
			});
		}

		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Generate redirect error:", error);
		return NextResponse.json(
			{
				error: "Failed to redirect to new endpoint",
				_deprecated: "This endpoint is deprecated. Please use /api/v2/stream/init instead.",
			},
			{ status: 500 },
		);
	}
}

/**
 * GET /api/v2/generate - Redirects to /api/v2/stream/init
 */
export async function GET(req: NextRequest) {
	const sessionId = req.nextUrl.searchParams.get("sessionId");

	// Forward to new endpoint
	const url = new URL("/api/v2/stream/init", req.url);
	if (sessionId) {
		url.searchParams.set("sessionId", sessionId);
	}

	try {
		const response = await fetch(url);
		const data = await response.json();

		// Add deprecation warning
		if (response.ok) {
			return NextResponse.json({
				...data,
				_deprecated: "This endpoint is deprecated. Please use /api/v2/stream/init instead.",
			});
		}

		return NextResponse.json(data, { status: response.status });
	} catch (error) {
		console.error("Generate GET redirect error:", error);
		return NextResponse.json(
			{
				error: "Failed to redirect to new endpoint",
				_deprecated: "This endpoint is deprecated. Please use /api/v2/stream/init instead.",
			},
			{ status: 500 },
		);
	}
}
