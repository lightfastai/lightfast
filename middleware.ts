import { nanoid } from "nanoid";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_EXPERIMENTAL_AGENT } from "@/mastra/agents/experimental";

export function middleware(request: NextRequest) {
	// Only apply to the root path
	if (request.nextUrl.pathname === "/") {
		// Generate a new thread ID
		const threadId = nanoid();

		// Redirect to the chat with the default agent and new thread ID
		return NextResponse.redirect(new URL(`/chat/${DEFAULT_EXPERIMENTAL_AGENT}/${threadId}`, request.url));
	}
}

// Configure which paths the middleware should run on
export const config = {
	matcher: "/",
};
