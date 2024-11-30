import { fileURLToPath } from "url";
import { createJiti } from "jiti";

import {
  config as nextConfig,
  withAnalyzer,
  withSentry,
} from "@repo/next/index.mjs";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await createJiti(fileURLToPath(import.meta.url)).import("./src/env");

/** @type {import("next").NextConfig} */
let config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/events", "@repo/ui"],

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
