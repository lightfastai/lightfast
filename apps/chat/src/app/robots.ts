import type { MetadataRoute } from "next";

/**
 * Generates the robots.txt configuration for the chat application.
 * Allows crawling of public pages while protecting authenticated routes.
 *
 * @returns {MetadataRoute.Robots} Next.js compatible robots.txt configuration
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing"],
        disallow: [
          "/new",
          "/sign-in",
          "/sign-up", 
          "/billing/upgrade",
          "/api/",
          "/*sessionId*",
          "/sso-callback",
        ],
      },
    ],
    sitemap: "https://chat.lightfast.ai/sitemap.xml",
  };
}