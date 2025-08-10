import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";

import "./src/env";

const withMDX = createMDX();

const config: NextConfig = {
	reactStrictMode: true,
	basePath: "/docs",
	assetPrefix: "/docs",
	
	/** Enables hot reloading for local packages without a build step */
	transpilePackages: [
		"@repo/ui",
		"@repo/url-utils",
		"@repo/vercel-config",
	],
};

export default withMDX(config);
