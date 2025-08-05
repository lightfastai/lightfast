import { NextConfig } from "next";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";

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
		if (process.env.NODE_ENV === 'development') {
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
		
		// In production, you might want to proxy to the deployed playground subdomain
		// For example: playground.lightfast.ai
		return [
			{
				source: '/playground',
				destination: 'https://playground.lightfast.ai/playground',
			},
			{
				source: '/playground/:path*',
				destination: 'https://playground.lightfast.ai/playground/:path*',
			},
		];
	},
};

export default withVercelToolbar()(config);

