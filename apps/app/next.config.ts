import {
  getPortlessProxyOrigins,
  withPortlessProxy,
} from "@lightfastai/dev-proxy/next";
import { withBetterStack } from "@logtail/next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import merge from "lodash.merge";
import type { NextConfig } from "next";
import { env } from "./src/env";

const portlessDevOrigins = [
  "lightfast",
  "app.lightfast",
  "www.lightfast",
  "platform.lightfast",
].flatMap((name) =>
  getPortlessProxyOrigins({ name, allowMissingConfig: true })
);

function localHostFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalhost =
      url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    return isLocalhost ? url.host : null;
  } catch {
    return null;
  }
}

function localServerActionHosts(): string[] {
  return Array.from(
    new Set(
      [
        env.NEXT_PUBLIC_APP_URL,
        env.NEXT_PUBLIC_WWW_URL,
        env.NEXT_PUBLIC_PLATFORM_URL,
      ].flatMap((value) => {
        const host = localHostFromUrl(value);
        return host ? [host] : [];
      })
    )
  );
}

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
    "@repo/app-billing",
    "@repo/app-validation",
    "@repo/ui",
    "@repo/url-utils",
    "@vendor/analytics",
    "@vendor/clerk",
    "@vendor/lib",
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
      "@repo/app-billing",
      "@repo/app-validation",
      "@repo/url-utils",
      "@vendor/analytics",
      "@vendor/clerk",
      "@vendor/lib",
      "@vendor/observability",
      "@vendor/security",
      "@vendor/seo",
    ],
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: (() => {
        const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
        if (vercelEnv === "production") {
          return ["lightfast.ai", "*.lightfast.ai"];
        }
        if (vercelEnv === "preview") {
          return ["lightfast.ai", "*.lightfast.ai", "*.vercel.app"];
        }
        return localServerActionHosts();
      })(),
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

const baseExport = withPortlessProxy(
  withMicrofrontends(config, {
    debug: env.NODE_ENV !== "production",
  }),
  { origins: portlessDevOrigins }
);

export default process.env.ANALYZE === "true"
  ? withBundleAnalyzer()(baseExport)
  : baseExport;
