"use client";

import NextLink from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";

const MENU_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Pricing", href: "/pricing" },
  { title: "Blog", href: "/blog" },
  { title: "Changelog", href: "/changelog" },
  { title: "Docs", href: "/docs/get-started/overview" },
];

export function PitchDeckNavbar() {
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="bg-card/80 backdrop-blur-sm rounded-xs! px-4 py-2">
            <span className="text-xs text-foreground mr-16">MENU</span>
          </NavigationMenuTrigger>
          <NavigationMenuContent className="left-1/2 -translate-x-1/2">
            <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
              {MENU_ITEMS.map((item) => (
                <NavigationMenuLink asChild key={item.href}>
                  <NextLink
                    href={item.href}
                    prefetch
                    className="text--foreground"
                  >
                    {item.title}
                  </NextLink>
                </NavigationMenuLink>
              ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
