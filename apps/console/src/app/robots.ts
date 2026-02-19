import type { MetadataRoute } from "next";
import { env } from "~/env";

export default function robots(): MetadataRoute.Robots {
  // Block all crawlers on non-production environments (preview, development)
  // VERCEL_ENV is "production" only for production deployments, "preview" for preview branches
  const isProduction = env.NEXT_PUBLIC_VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  // Production: Allow AI crawlers with specific permissions
  // Strategy: Allow ALL training bots for maximum AEO/GEO visibility
  return {
    rules: [
      // General crawlers - block authenticated/private routes
      // Note: RSS/Atom feeds at /blog/*.xml and /changelog/*.xml are publicly accessible
      // Note: Microfrontends setup - console is catch-all, www handles marketing, auth handles sign-in/sign-up
      {
        userAgent: "*",
        allow: [
          "/",
          "/llms.txt", // AI crawler guidance file (standard for LLMs to understand site)
          "/llms-full.txt", // Full page content in markdown for AI crawlers
          "/api/og/*", // Public OG image generation endpoints
        ],
        disallow: [
          // API routes (console app)
          "/api/", // All API routes including tRPC, Inngest, GitHub, Vercel webhooks

          // Authenticated user routes (console app)
          "/account/", // User account management
          "/new/", // Organization creation flow

          // Organization/workspace private routes (console app: /[orgSlug]/...)
          "/*/settings/", // Org and workspace settings
          "/*/sources/", // Source integrations management
          "/*/insights/", // Analytics and insights
          "/*/jobs/", // Background jobs
          "/*/search/", // Authenticated workspace search

          // Internal/preview/test content (www app)
          "/pitch-deck", // Internal pitch deck
          "/preview", // Preview mode
          "/unicorn-test", // Test route

          // OAuth and sensitive flows
          "/oauth/", // OAuth callback routes (GitHub, Vercel)
          "/confirm/", // Email confirmations
        ],
      },
      // OpenAI - Critical for ChatGPT Search & SearchGPT
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
      },
      // GPTBot - For OpenAI model training
      {
        userAgent: "GPTBot",
        allow: "/",
      },
      // Common Crawl - Dataset for AI research and training
      {
        userAgent: "CCBot",
        allow: "/",
      },
      // Perplexity - Growing answer engine
      {
        userAgent: "PerplexityBot",
        allow: "/",
      },
      // Anthropic Claude - Web search capability
      {
        userAgent: "Claude-Web",
        allow: "/",
      },
      // Google AI - For AI Overviews and Gemini training
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
      // Anthropic AI - For Claude model training (different from Claude-Web search)
      {
        userAgent: "anthropic-ai",
        allow: "/",
      },
      // Cohere AI
      {
        userAgent: "cohere-ai",
        allow: "/",
      },
      // Meta AI - Facebook's answer engine
      {
        userAgent: "FacebookBot",
        allow: "/",
      },
      {
        userAgent: "meta-externalagent",
        allow: "/",
      },
      // Amazon Alexa
      {
        userAgent: "Amazonbot",
        allow: "/",
      },
      // Apple Siri/Spotlight
      {
        userAgent: "Applebot",
        allow: "/",
      },
      // Apple AI training
      {
        userAgent: "Applebot-Extended",
        allow: "/",
      },
      // Content aggregation bots
      {
        userAgent: "Omgilibot",
        allow: "/",
      },
      {
        userAgent: "Omgili",
        allow: "/",
      },
    ],
    sitemap: "https://lightfast.ai/sitemap.xml",
  };
}
