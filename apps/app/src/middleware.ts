import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkMiddlewareConfig } from "@repo/url-utils";

const clerkConfig = getClerkMiddlewareConfig("app");

export default clerkMiddleware(clerkConfig);

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};