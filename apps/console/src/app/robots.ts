import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Block all crawlers on non-production environments (preview, development)
  // VERCEL_ENV is "production" only for production deployments, "preview" for preview branches
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: ["/"],
      },
    };
  }

  // Production: Allow AI crawlers with specific permissions
  return {
    rules: [
      // General crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
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
      // GPTBot - For OpenAI model training (optional but recommended)
      {
        userAgent: "GPTBot",
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
      // Google AI - For AI Overviews
      {
        userAgent: "Google-Extended",
        allow: "/",
      },
      // Cohere AI
      {
        userAgent: "cohere-ai",
        allow: "/",
      },
    ],
    sitemap: "https://lightfast.ai/sitemap.xml",
  };
}
