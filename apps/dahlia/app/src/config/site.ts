import type { SiteConfig } from "@repo/ui/types/site";
import type { NavItem } from "@repo/ui/types/nav";

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
}

export const siteNav: SiteNav = {
  mainNav: [],
};
