import { fileURLToPath } from "url";
import createJiti from "jiti";
import { createContentlayerPlugin } from "next-contentlayer2";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
createJiti(fileURLToPath(import.meta.url))("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
<<<<<<< HEAD:apps/docs/next.config.mjs
  transpilePackages: ["@repo/ui"],
=======
  transpilePackages: [
    "@repo/lib",
    "@repo/ui",
    "@repo/webgl",
    "@repo/threejs",
    "@vendor/clerk",
    "@vendor/db",
    "@vendor/trpc",
    "@vendor/observability",
  ],
>>>>>>> staging:apps/app/next.config.mjs

  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

const withContentlayer = createContentlayerPlugin({
  // Additional Contentlayer config options
});

export default withContentlayer(config);
