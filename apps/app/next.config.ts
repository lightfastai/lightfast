import { withBetterStack } from "@logtail/next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import merge from "lodash.merge";
import type { NextConfig } from "next";
import { env } from "./src/env";

const appConfig: NextConfig = merge({}, baseConfig, {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  transpilePackages: [
    "@api/app",
    "@db/app",
    "@repo/app-ai",
    "@repo/app-ai-types",
    "@repo/app-api-key",
    "@repo/app-auth-middleware",
    "@repo/app-clerk-cache",
    "@repo/app-embed",
    "@repo/app-octokit-github",
    "@repo/app-pinecone",
    "@repo/app-providers",
    "@repo/app-trpc",
    "@repo/app-upstash-realtime",
    "@repo/app-validation",
    "@repo/app-vercel",
    "@repo/lib",
    "@repo/prompt-engine",
    "@repo/ui",
    "@repo/url-utils",
    "@vendor/analytics",
    "@vendor/clerk",
    "@vendor/knock",
    "@vendor/next",
    "@vendor/observability",
    "@vendor/security",
    "@vendor/seo",
    "@vendor/upstash",
  ],
  experimental: {
    optimizePackageImports: [
      "recharts",
      "shiki",
      "date-fns",
      "octokit",
      "@repo/app-ai",
      "@repo/app-ai-types",
      "@repo/app-api-key",
      "@repo/app-auth-middleware",
      "@repo/app-clerk-cache",
      "@repo/app-embed",
      "@repo/app-octokit-github",
      "@repo/app-pinecone",
      "@repo/app-rerank",
      "@repo/app-trpc",
      "@repo/app-validation",
      "@repo/app-vercel",
      "@repo/app-providers",
      "@repo/app-workspace-cache",
      "@repo/lib",
      "@repo/url-utils",
      "@vendor/analytics",
      "@vendor/clerk",
      "@vendor/knock",
      "@vendor/observability",
      "@vendor/security",
      "@vendor/seo",
    ],
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins:
        env.NODE_ENV === "development"
          ? ["localhost:*"]
          : ["lightfast.ai", "*.lightfast.ai"],
    },
  },
  async redirects() {
    return [
      {
        source: "/features/timeline",
        destination: "/",
        permanent: true,
      },
      {
        source: "/features/memory",
        destination: "/",
        permanent: true,
      },
      {
        source: "/features/connectors",
        destination: "/",
        permanent: true,
      },
      {
        source: "/features/agents",
        destination: "/",
        permanent: true,
      },
      {
        source: "/changelog/0-1-lightfast-neural-memory-foundation-2026",
        destination: "/changelog/lightfast-neural-memory-foundation-2026",
        permanent: true,
      },
      {
        source: "/changelog/0-2-lightfast-neural-memory",
        destination: "/changelog/lightfast-observation-entity-extraction-2026",
        permanent: true,
      },
      {
        source: "/changelog/0-3-lightfast-search-api-hybrid-retrieval",
        destination: "/changelog/lightfast-search-api-hybrid-retrieval-2026",
        permanent: true,
      },
      {
        source: "/sitemap-index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
    ];
  },
} satisfies NextConfig);

const config = withSentryConfig(
  withBetterStack(withVercelToolbar()(appConfig)),
  sentryOptions
);

const baseExport = withMicrofrontends(config, {
  debug: env.NODE_ENV !== "production",
});

export default process.env.ANALYZE === "true"
  ? withBundleAnalyzer()(baseExport)
  : baseExport;
