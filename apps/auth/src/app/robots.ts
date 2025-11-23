import type { MetadataRoute } from "next";

/**
 * Generates the robots.txt configuration for Lightfast Auth.
 * Allows minimal indexing of public auth pages while protecting sensitive routes.
 *
 * @returns {MetadataRoute.Robots} Next.js compatible robots.txt configuration
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/sign-in"], // Allow indexing of public auth pages (sign-up is dev-only)
      disallow: [
        "/api/", // Protect API routes
        "/_next/", // Protect Next.js internal files
        "/sso-callback/", // Protect SSO callbacks
        "/sign-up/", // Protect dev-only sign-up page
        "/**/error", // Don't index error pages
      ],
    },
    sitemap: "https://auth.lightfast.ai/sitemap.xml",
  };
}