import type { NavItem, NavItemWithChildren } from "@repo/ui/types/nav";
import type { SiteConfig } from "@repo/ui/types/site";

export const siteConfig: SiteConfig = {
  name: "Dahlia",
  url: "https://dahlia.ai",
  ogImage: "https://dahlia.ai/og.jpg",
  description:
    "Beautifully designed components that you can copy and paste into your apps. Accessible. Customizable. Open Source.",
  links: {
    twitter: "https://twitter.com/dahlia_ai",
    github: "https://github.com/dahlia-ai",
  },
};

export interface SiteNav {
  mainNav: NavItem[];
  docsNav: NavItemWithChildren[];
}

export const siteNav: SiteNav = {
  mainNav: [
    {
      title: "Playground",
      href: "/playground",
    },
    {
      title: "Docs",
      href: "/docs/introduction",
    },
  ],
  docsNav: [
    {
      title: "Dahlia SDK",
      items: [
        {
          title: "Introduction",
          href: "/docs/introduction",
          items: [],
        },
      ],
    },
    {
      title: "Foundations",
      items: [
        {
          title: "Overview",
          href: "/docs/foundations/overview",
          items: [],
        },
        {
          title: "WebGL",
          href: "/docs/foundations/webgl",
          items: [],
        },
        {
          title: "Dahlia Engine",
          href: "/docs/foundations/engine",
          items: [],
        },
      ],
    },
    {
      title: "Texture Operators",
      href: "/docs/texture-operators",
      items: [
        {
          title: "Noise",
          href: "/docs/texture-operators/noise",
          items: [],
        },
        {
          title: "Limit",
          href: "/docs/texture-operators/limit",
          items: [],
        },
      ],
    },
  ],
};
