import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
	"/",
	"/api/health",
	"/api/cli/v1/(.*)",  // Allow all CLI API routes through tRPC
	"/playground",
	"/playground/(.*)",
	"/robots.txt",
	"/sitemap.xml",
]);

const isProtectedRoute = createRouteMatcher([
	"/orgs/(.*)",
]);

const isRootRedirect = createRouteMatcher(["/"]);

export default clerkMiddleware(
	async (auth, req: NextRequest) => {
		// Handle root path redirect logic
		if (isRootRedirect(req)) {
			const { userId, orgSlug, redirectToSignIn } = await auth();

			if (userId) {
				if (orgSlug) {
					return NextResponse.redirect(new URL(`/orgs/${orgSlug}/dashboard`, req.url));
				} else {
					// Let redirectToSignIn handle routing to appropriate auth flow
					return redirectToSignIn();
				}
			} else {
				// Unauthenticated users should see the landing page
				return NextResponse.next();
			}
		}

		// Protect organization routes
		if (isProtectedRoute(req)) {
			await auth.protect();
		}

		// Protect non-public routes
		if (!isPublicRoute(req)) {
			await auth.protect();
		}

		return NextResponse.next();
	},
	{
		organizationSyncOptions: {
			organizationPatterns: [
				"/orgs/:slug",
				"/orgs/:slug/(.*)",
			],
		}
	}
);

export const config = {
	matcher: [
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
