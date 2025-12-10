import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github" | "discord" | "chat" | "home";

export const siteConfig: SiteConfig<SiteLinks> = {
  name: "Lightfast Docs",
  url: "https://lightfast.ai/docs",
  ogImage: "https://lightfast.ai/og.jpg",
  description:
    "Documentation for Lightfast neural memory — Learn how to integrate the memory layer for software teams via a simple REST API and MCP tools. Build search by meaning with sources.",
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
    "memory layer",
    "memory layer for software teams",
    "software team memory",
    "engineering knowledge search",
    "neural memory docs",
    "semantic search",
    "semantic search docs",
    "answers with sources",
    "developer API",
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
