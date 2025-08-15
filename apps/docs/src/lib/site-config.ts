import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github" | "discord" | "chat" | "home";

export const siteConfig: SiteConfig<SiteLinks> = {
	name: "Lightfast Docs",
	url: "https://chat.lightfast.ai",
	ogImage: "https://lightfast.ai/og.jpg",
	description:
		"Documentation for Lightfast Chat - Learn how to build and deploy real-time AI chat applications with Claude 4, GPT-4o, and streaming responses.",
	links: {
		twitter: {
			title: "Twitter",
			href: "https://x.com/lightfastai",
			external: true,
		},
		github: {
			title: "GitHub",
			href: "https://github.com/lightfastai/chat",
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
		"AI agent docs",
		"agent framework documentation",
		"AI orchestration guide",
		"state machine tutorials",
		"agent deployment guide",
		"AI infrastructure docs",
		"developer API reference",
		"workflow automation docs",
		"resource scheduling guide",
		"security best practices",
		"SDK documentation",
		"agent platform docs",
	],
	authors: [
		{
			name: "Lightfast",
			url: "https://lightfast.ai",
		},
	],
	creator: "Lightfast",
} as const;
