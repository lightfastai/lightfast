import { nanoid } from "nanoid";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Hardcode the default agent to avoid loading any agent code in middleware
const DEFAULT_EXPERIMENTAL_AGENT = "a011";

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
