import type { NavItem } from "@repo/ui/types/nav";
import type { SiteConfig } from "@repo/ui/types/site";

export const siteConfig: SiteConfig = {
  name: "Dahlia",
  url: "https://dahlia.art",
  ogImage: "https://dahlia.art/og.jpg",
  description:
    "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.",
  links: {
    twitter: "https://twitter.com/dahlia-ai",
    github: "https://github.com/dahlia-ai",
  },
};

export interface SiteNav {
  mainNav: NavItem[];
  footerNav: NavItem[];
}

export const siteNav: SiteNav = {
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
  ],
  footerNav: [
    {
      title: "Docs",
      href: "https://dahlia.art/docs",
    },
    {
      title: "GitHub",
      href: "https://github.com/dahlia-ai",
    },
    {
      title: "Terms",
      href: "https://dahlia.art/legal/terms",
    },
    {
      title: "Privacy",
      href: "https://dahlia.art/legal/privacy",
    },
  ],
};
