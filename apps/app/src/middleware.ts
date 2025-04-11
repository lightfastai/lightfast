import { clerkMiddleware, createRouteMatcher } from "@vendor/clerk/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/",
  "/api/health",
]);

// Define workspace routes pattern for specific checks
const isWorkspaceRoute = createRouteMatcher(["/workspace/:id(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    // Allow public routes without authentication
    if (isPublicRoute(req)) {
      return;
    }

    // Protect all non-public routes with basic authentication
    const session = await auth.protect();

    // Additional workspace-specific authorization
    if (isWorkspaceRoute(req)) {
      // Ensure user is authenticated
      if (!session.userId) {
        return Response.redirect(new URL("/sign-in", req.url));
      }

      // Extract workspace ID from URL
      const url = new URL(req.url);
      const workspaceId = url.pathname.split("/")[2]; // /workspace/:id

      // For workspace routes, we'll let the route handlers do the detailed authorization
      // This is because the workspace authorization requires database access which is better
      // handled in the route handlers using tRPC protectedProcedure

      // The actual workspace access check is done in:
      // 1. workspace layout component
      // 2. tRPC workspace router procedures
      // 3. Individual workspace-related API endpoints
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
