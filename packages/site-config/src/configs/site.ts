import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks =
  | "twitter"
  | "github"
  | "discord"
  | "privacy"
  | "terms"
  | "chat";

export const siteConfig: SiteConfig<SiteLinks> = {
  name: "Lightfast",
  url: "https://lightfast.ai",
  ogImage: "https://lightfast.ai/og.jpg",
  description:
    "Lightfast is neural memory built for teams. Search everything your organization knows by meaning, get answers with sources, and trace decisions across code, docs, and tools via a developer-first API and MCP tools.",
  links: {
    twitter: {
      title: "Twitter",
      href: "https://x.com/lightfastai",
    },
    github: {
      title: "GitHub",
      href: "https://github.com/lightfastai",
    },
    discord: {
      title: "Discord",
      href: "https://discord.gg/YqPDfcar2C",
    },
    privacy: {
      title: "Privacy Policy",
      href: "https://lightfast.ai/legal/privacy",
    },
    terms: {
      title: "Terms & Conditions",
      href: "https://lightfast.ai/legal/terms",
    },
    chat: {
      title: "Try Chat",
      href: "https://chat.lightfast.ai",
    },
  },
  location: "3141, Melbourne, VIC, Australia",
};
