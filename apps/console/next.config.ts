import { NextConfig } from "next";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "./src/env";

import {
  config as vendorConfig,
  withBetterStack,
  withSentry,
} from "@vendor/next/next-config-builder";
import { mergeNextConfig } from "@vendor/next/merge-config";
import { getDocsUrl } from "@repo/app-urls";

const config: NextConfig = withSentry(
  withBetterStack(
    mergeNextConfig(vendorConfig, {
      reactStrictMode: true,
      transpilePackages: [
        // @api packages
        "@api/console",
        // @db packages
        "@db/console",
        // @repo packages
        "@repo/app-urls",
        "@repo/console-api-services",
        "@repo/console-auth-middleware",
        "@repo/console-backfill",
        "@repo/console-embed",
        "@repo/console-oauth",
        "@repo/console-octokit-github",
        "@repo/console-pinecone",
        "@repo/console-trpc",
        "@repo/console-types",
        "@repo/console-validation",
        "@repo/console-vercel",
        "@repo/console-webhooks",
        "@repo/lib",
        "@repo/site-config",
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
        optimizeCss: true,
        optimizePackageImports: [
          // Already present
          "@repo/ui",
          "lucide-react",
          // Heavy third-party libraries
          "recharts",
          "shiki",
          "date-fns",
          "octokit",
          // Internal packages (all transpilePackages except console-backfill)
          "@repo/console-ai",
          "@repo/console-ai-types",
          "@repo/console-api-key",
          "@repo/console-api-services",
          "@repo/console-auth-middleware",
          "@repo/console-clerk-cache",
          "@repo/console-embed",
          "@repo/console-oauth",
          "@repo/console-octokit-github",
          "@repo/console-pinecone",
          "@repo/console-rerank",
          "@repo/console-trpc",
          "@repo/console-types",
          "@repo/console-validation",
          "@repo/console-vercel",
          "@repo/console-webhooks",
          "@repo/console-workspace-cache",
          "@repo/lib",
          "@repo/site-config",
          "@repo/url-utils",
          "@repo/app-urls",
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
      },
      async rewrites() {
        // Proxy /docs to the docs app
        // Keep /docs prefix since docs app folder structure has app/docs/
        const docsUrl = getDocsUrl();

        return [
          {
            source: "/docs",
            destination: `${docsUrl}/docs`,
          },
          {
            source: "/docs/:path*",
            destination: `${docsUrl}/docs/:path*`,
          },
        ];
      },
    }),
  ),
);

export default withMicrofrontends(config, { debug: true });
