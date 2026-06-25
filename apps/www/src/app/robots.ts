import type { MetadataRoute } from "next";
import { env } from "~/env";
import { SITE_IDENTITY } from "~/lib/site/identity";

const privateWorkspaceRouteSegments = [
  "automations",
  "chat",
  "connectors",
  "decisions",
  "insights",
  "jobs",
  "mcp",
  "people",
  "search",
  "settings",
  "signals",
  "skills",
] as const;

const disallowPaths = [
  // App/API surfaces
  "/api/",
  "/oauth/",
  "/.well-known/",

  // Auth and account surfaces
  "/account",
  "/accounts",
  "/new/",
  "/sign-in",
  "/sign-up",
  "/confirm/",

  // Organization/workspace private routes from the default app
  ...privateWorkspaceRouteSegments.flatMap((segment) => [
    `/*/${segment}$`,
    `/*/${segment}/`,
  ]),
] as const;

export default function robots(): MetadataRoute.Robots {
  const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt"],
      disallow: [...disallowPaths],
    },
    sitemap: `${SITE_IDENTITY.baseUrl}/sitemap.xml`,
  };
}
