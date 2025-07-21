import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	// Block all crawling - this is an experimental site
	return {
		rules: [
			{
				userAgent: "*",
				disallow: "/",
				crawlDelay: 86400,
			},
			// Specific rules for major search engines
			{
				userAgent: "Googlebot",
				disallow: "/",
			},
			{
				userAgent: "Bingbot",
				disallow: "/",
			},
			{
				userAgent: "Slurp",
				disallow: "/",
			},
			{
				userAgent: "DuckDuckBot",
				disallow: "/",
			},
			{
				userAgent: "Baiduspider",
				disallow: "/",
			},
			{
				userAgent: "YandexBot",
				disallow: "/",
			},
		],
		// No sitemap for experimental site
		sitemap: undefined,
	};
}