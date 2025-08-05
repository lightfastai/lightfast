import { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import { playgroundUrl } from "./src/lib/related-projects";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: [
		"@repo/ui",
		"@repo/lightfast-config",
		"@repo/lightfast-react",
		"@repo/url-utils",
		"@vendor/clerk",
	],
	experimental: {
		optimizeCss: true,
		optimizePackageImports: ["@repo/ui", "lucide-react"],
	},
	async rewrites() {
		// The playgroundUrl helper handles both dev (localhost:4105) and production URLs
		return [
			{
				source: '/playground',
				destination: `${playgroundUrl}/playground`,
			},
			{
				source: '/playground/:path*',
				destination: `${playgroundUrl}/playground/:path*`,
			},
		];
	},
};

export default withVercelToolbar()(config);

