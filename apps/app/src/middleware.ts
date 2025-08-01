import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig } from "@repo/url-utils";

const clerkConfig = getClerkMiddlewareConfig("app");

export default clerkMiddleware(clerkConfig);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};

