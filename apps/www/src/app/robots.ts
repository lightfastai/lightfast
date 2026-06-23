import type { MetadataRoute } from "next";
import { env } from "~/env";

const BASE_URL = "https://lightfast.ai";

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
  "/*/automations/",
  "/*/chat/",
  "/*/connectors/",
  "/*/decisions/",
  "/*/developer-connections/",
  "/*/insights/",
  "/*/jobs/",
  "/*/mcp/",
  "/*/people/",
  "/*/search/",
  "/*/settings/",
  "/*/signals/",
  "/*/skills/",
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
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
