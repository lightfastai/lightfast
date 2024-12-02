import { fileURLToPath } from "url";
import {
  config as nextConfig,
  withAnalyzer,
  withSentry,
} from "@vendor/next/index.mjs";
import { createJiti } from "jiti";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await createJiti(fileURLToPath(import.meta.url)).import("./src/env");

/** @type {import("next").NextConfig} */
let config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/db", "@vendor/next"],

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
