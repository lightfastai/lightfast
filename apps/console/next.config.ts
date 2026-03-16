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
        "@api/console",
        // @db packages
        "@db/console",
        // @repo packages
        "@repo/console-api-services",
        "@repo/console-auth-middleware",
        "@repo/console-embed",
        "@repo/console-octokit-github",
        "@repo/console-pinecone",
        "@repo/console-trpc",
        "@repo/console-validation",
        "@repo/console-vercel",
        "@repo/console-providers",
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
          "@repo/console-ai",
          "@repo/console-ai-types",
          "@repo/console-api-key",
          "@repo/console-api-services",
          "@repo/console-auth-middleware",
          "@repo/console-clerk-cache",
          "@repo/console-embed",
          "@repo/console-octokit-github",
          "@repo/console-pinecone",
          "@repo/console-rerank",
          "@repo/console-trpc",
          "@repo/console-types",
          "@repo/console-validation",
          "@repo/console-vercel",
          "@repo/console-providers",
          "@repo/console-workspace-cache",
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
      async rewrites() {
        // Proxy /docs to the docs app
        // Keep /docs prefix since docs app folder structure has app/docs/
        const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
        const docsUrl =
          vercelEnv === "production" ||
          vercelEnv === "preview" ||
          process.env.NODE_ENV === "production"
            ? "https://lightfast-docs.vercel.app"
            : "http://localhost:4105";

        const isProd =
          vercelEnv === "production" ||
          vercelEnv === "preview" ||
          process.env.NODE_ENV === "production";

        const gatewayUrl = isProd
          ? "https://lightfast-gateway.vercel.app"
          : "http://localhost:4110";
        const relayUrl = isProd
          ? "https://lightfast-relay.vercel.app"
          : "http://localhost:4108";
        const backfillUrl = isProd
          ? "https://lightfast-backfill.vercel.app"
          : "http://localhost:4109";

        return [
          {
            source: "/docs",
            destination: `${docsUrl}/docs`,
          },
          {
            source: "/docs/:path*",
            destination: `${docsUrl}/docs/:path*`,
          },
          {
            source: "/services/gateway/:path*",
            destination: `${gatewayUrl}/services/gateway/:path*`,
          },
          {
            source: "/services/relay/:path*",
            destination: `${relayUrl}/api/:path*`,
          },
          {
            source: "/services/backfill/:path*",
            destination: `${backfillUrl}/api/:path*`,
          },
        ];
      },
    })
  )
);

export default withMicrofrontends(config, {
  debug: env.NODE_ENV !== "production",
});
