import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@mastra/*", 
  ],
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@lightfast/ai",
    "@lightfast/types",
    "@lightfast/evals",
  ],
  experimental: {
    /** Optimize client-side routing */
    optimizePackageImports: ["@ai-sdk/react", "@mastra/core"],
  },
};

export default nextConfig;
