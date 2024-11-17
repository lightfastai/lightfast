import type { NavItemRecord } from "@repo/ui/types/nav";
import type { SiteConfig } from "@repo/ui/types/site";

type SiteLinks = "twitter" | "github";
type SiteNavFooterLinks = "docs" | "github" | "terms" | "privacy";
type SiteNavMainLinks = "home";

export const siteConfig: SiteConfig<SiteLinks> = {
  name: "Dahlia",
  url: "https://dahlia.art",
  ogImage: "https://dahlia.art/og.jpg",
  description:
    "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.",
  links: {
    twitter: {
      title: "Twitter",
      href: "https://twitter.com/dahlia-ai",
    },
    github: {
      title: "GitHub",
      href: "https://github.com/dahlia-ai",
    },
  },
};

export interface SiteNav {
  primary: NavItemRecord<SiteNavMainLinks>;
  footer: NavItemRecord<SiteNavFooterLinks>;
}

export const siteNav: SiteNav = {
  primary: {
    home: {
      title: "Home",
      href: "/",
    },
  },
  footer: {
    docs: {
      title: "Docs",
      href: "https://dahlia.art/docs",
    },
    github: {
      title: "GitHub",
      href: "https://github.com/dahlia-ai",
    },
    terms: {
      title: "Terms",
      href: "https://dahlia.art/legal/terms",
    },
    privacy: {
      title: "Privacy",
      href: "https://dahlia.art/legal/privacy",
    },
  },
};
