import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github" | "discord" | "chat" | "home";

export const siteConfig: SiteConfig<SiteLinks> = {
	name: "Lightfast Docs",
	url: "https://docs.lightfast.ai",
	ogImage: "https://lightfast.ai/og.jpg",
	description:
		"Documentation for Lightfast Neural Memory — Learn how to integrate team memory via simple REST API and MCP tools. Build search by meaning with sources.",
	links: {
		twitter: {
			title: "Twitter",
			href: "https://x.com/lightfastai",
			external: true,
		},
		github: {
			title: "GitHub",
			href: "https://github.com/lightfastai/lightfast",
			external: true,
		},
		discord: {
			title: "Discord",
			href: "https://discord.gg/YqPDfcar2C",
			external: true,
		},
		chat: {
			title: "Chat App",
			href: "https://chat.lightfast.ai",
			external: true,
		},
		home: {
			title: "Lightfast Home",
			href: "https://lightfast.ai",
			external: true,
		},
	},
	location: "3141, Melbourne, VIC, Australia",
};

// Export additional metadata for docs
export const docsMetadata = {
	keywords: [
		"Lightfast documentation",
		"neural memory docs",
		"organizational memory docs",
		"semantic search docs",
		"answers with sources",
		"developer API reference",
		"MCP tools",
		"REST API",
		"security best practices",
	],
	authors: [
		{
			name: "Lightfast",
			url: "https://lightfast.ai",
		},
	],
	creator: "Lightfast",
} as const;
