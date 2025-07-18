import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";

export function middleware(request: NextRequest) {
	// Only apply to the root path
	if (request.nextUrl.pathname === "/") {
		// Generate a new thread ID
		const threadId = nanoid();
		
		// Redirect to the chat with the new thread ID
		return NextResponse.redirect(new URL(`/chat/${threadId}`, request.url));
	}
}

// Configure which paths the middleware should run on
export const config = {
	matcher: "/",
};