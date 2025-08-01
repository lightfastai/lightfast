import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
	/** Enables hot reloading for local packages without a build step */
	transpilePackages: [
		"@repo/ui",
		"@lightfast/core",
		"@lightfast/types",
		"@lightfast/evals",
	],
	experimental: {
		/** Optimize client-side routing */
		optimizePackageImports: ["@ai-sdk/react"],
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default nextConfig;
