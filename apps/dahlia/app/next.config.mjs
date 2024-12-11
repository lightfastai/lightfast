import { fileURLToPath } from "url";
import createJiti from "jiti";

import {
  config as nextConfig,
  withAnalyzer,
  withSentry,
} from "@vendor/next/index.mjs";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
let config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@repo/ai",
    "@dahlia/trpc",
    "@repo/lib",
    "@repo/ui",
    "@repo/webgl",
    "@vendor/clerk",
    "@vendor/db",
    "@vendor/trpc",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  /** Shared next config */
  ...nextConfig,
};

if (process.env.VERCEL) {
  config = withSentry(config);
}

if (process.env.ANALYZE === "true") {
  config = withAnalyzer(config);
}

export default config;
