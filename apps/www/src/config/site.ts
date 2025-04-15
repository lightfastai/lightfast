import { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github" | "discord";

export const siteConfig: SiteConfig<SiteLinks> = {
  name: "Lightfast",
  url: "https://lightfast.ai",
  ogImage: "https://lightfast.ai/og.jpg",
  description: "Lightfast is a integration layer for AI design workflows",
  links: {
    twitter: {
      title: "Twitter",
      href: "https://x.com/lightfast",
    },
    github: {
      title: "GitHub",
      href: "https://github.com/lightfast",
    },
    discord: {
      title: "Discord",
      href: "https://discord.gg/lightfast",
    },
  },
};
