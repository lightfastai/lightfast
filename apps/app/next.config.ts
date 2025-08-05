import { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import { withRelatedProjects } from "@vercel/related-projects/next";
import { env } from "./src/env";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@repo/ui"],
	experimental: {
		optimizeCss: true,
		optimizePackageImports: ["@repo/ui", "lucide-react"],
	},
	async rewrites() {
		// In production, playground will be deployed separately with its own domain
		// These rewrites are only for local development
		if (env.NODE_ENV === 'development') {
			return [
				{
					source: '/playground',
					destination: 'http://localhost:4105/playground',
				},
				{
					source: '/playground/:path*',
					destination: 'http://localhost:4105/playground/:path*',
				},
			];
		}
		
		// In production, use the related project URL which will be automatically
		// resolved by Vercel based on the deployment environment
		const playgroundHost = process.env.VERCEL_RELATED_PROJECT_PLAYGROUND_URL || 'https://playground.lightfast.ai';
		
		return [
			{
				source: '/playground',
				destination: `${playgroundHost}/playground`,
			},
			{
				source: '/playground/:path*',
				destination: `${playgroundHost}/playground/:path*`,
			},
		];
	},
};

export default withVercelToolbar()(withRelatedProjects(config));

