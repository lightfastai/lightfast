import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { nanoid } from "@/lib/nanoid";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/webhooks(.*)"]);

// Hardcode the default agent to avoid loading any agent code in middleware
const DEFAULT_EXPERIMENTAL_AGENT = "a011";

export default clerkMiddleware(async (auth, req) => {
	// Check if the route is public
	if (isPublicRoute(req)) {
		return NextResponse.next();
	}

	// Protect all other routes
	const { userId } = await auth();
	if (!userId) {
		// Redirect to sign-in if not authenticated
		const signInUrl = new URL("/sign-in", req.url);
		signInUrl.searchParams.set("redirect_url", req.url);
		return NextResponse.redirect(signInUrl);
	}

	// Handle root path redirect for authenticated users
	if (req.nextUrl.pathname === "/") {
		// Generate a new thread ID
		const threadId = nanoid();

		// Redirect to the chat with the default agent and new thread ID
		// Thread ownership will be established when the user sends their first message
		return NextResponse.redirect(new URL(`/chat/${DEFAULT_EXPERIMENTAL_AGENT}/${threadId}`, req.url));
	}

	return NextResponse.next();
});

// Configure which paths the middleware should run on
export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
