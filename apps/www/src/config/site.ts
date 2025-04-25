import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github" | "discord" | "privacy" | "terms";

export const siteConfig: SiteConfig<SiteLinks> = {
  name: "Lightfast",
  url: "https://lightfast.ai",
  ogImage: "https://lightfast.ai/og.jpg",
  description: "Lightfast is a integration layer for AI design workflows",
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
      href: "https://discord.gg/lightfastai",
    },
    privacy: {
      title: "Privacy Policy",
      href: "https://lightfast.ai/legal/privacy",
    },
    terms: {
      title: "Terms & Conditions",
      href: "https://lightfast.ai/legal/terms",
    },
  },
  location: "3141, Melbourne, VIC, Australia",
};
