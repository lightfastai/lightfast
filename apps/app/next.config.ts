import { mergeNextConfig } from "@vendor/next/merge-config";
import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";
import { env } from "./src/env";

const config: NextConfig = withSentry(
  withBetterStack(
    mergeNextConfig(vendorConfig, {
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
        // @api packages
        "@api/app",
        // @db packages
        "@db/app",
        // @repo packages
        "@repo/app-auth-middleware",
        "@repo/app-embed",
        "@repo/app-octokit-github",
        "@repo/app-pinecone",
        "@repo/app-trpc",
        "@repo/app-validation",
        "@repo/app-vercel",
        "@repo/app-providers",
        "@repo/lib",
        "@repo/ui",
        "@repo/url-utils",
        // @vendor packages
        "@vendor/analytics",
        "@vendor/clerk",
        "@vendor/cms",
        "@vendor/knock",
        "@vendor/next",
        "@vendor/observability",
        "@vendor/security",
        "@vendor/seo",
      ],
      experimental: {
        optimizePackageImports: [
          // Heavy third-party libraries
          "recharts",
          "shiki",
          "date-fns",
          "octokit",
          // Internal packages
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
          // Vendor packages
          "@vendor/analytics",
          "@vendor/clerk",
          "@vendor/cms",
          "@vendor/knock",
          "@vendor/observability",
          "@vendor/security",
          "@vendor/seo",
        ],
        turbopackScopeHoisting: false,
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
          // Changelog slug migration: version-prefixed slugs → clean descriptive slugs
          {
            source: "/changelog/0-1-lightfast-neural-memory-foundation-2026",
            destination: "/changelog/lightfast-neural-memory-foundation-2026",
            permanent: true,
          },
          {
            source: "/changelog/0-2-lightfast-neural-memory",
            destination:
              "/changelog/lightfast-observation-entity-extraction-2026",
            permanent: true,
          },
          {
            source: "/changelog/0-3-lightfast-search-api-hybrid-retrieval",
            destination:
              "/changelog/lightfast-search-api-hybrid-retrieval-2026",
            permanent: true,
          },
          // Bots probe these common sitemap index filenames, but Next.js only
          // generates /sitemap.xml. Without these, requests fall through to the
          // [slug] dynamic route and trigger an authenticated tRPC prefetch.
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
    })
  )
);

export default withMicrofrontends(config, {
  debug: env.NODE_ENV !== "production",
});
