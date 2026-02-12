"use client";

import NextLink from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";
import { RESOURCES_NAV } from "~/config/nav";

const navLinkClass =
  "text-foreground/60 hover:text-foreground transition-colors" as const;

export function PitchDeckNavbar() {
  return (
    <div className="flex items-center gap-0.5">
      {/* Resources dropdown */}
      <NavigationMenu viewport={false} className="static [&>div]:!static">
        <NavigationMenuList>
          <NavigationMenuItem className="static">
            <NavigationMenuTrigger
              className={`px-1.5 text-sm rounded bg-transparent hover:bg-transparent dark:hover:bg-transparent focus:bg-transparent dark:focus:bg-transparent data-[state=open]:bg-transparent dark:data-[state=open]:bg-transparent hover:text-foreground dark:hover:text-foreground focus:text-foreground dark:focus:text-foreground data-[state=open]:text-foreground dark:data-[state=open]:text-foreground ${navLinkClass}`}
            >
              Resources
            </NavigationMenuTrigger>
            <NavigationMenuContent className="left-0 right-0 w-full md:w-full">
              <div className="flex flex-col gap-1 rounded-sm">
                {RESOURCES_NAV.map((item) => (
                  <NavigationMenuLink asChild key={item.href}>
                    <NextLink href={item.href} prefetch>
                      {item.title}
                    </NextLink>
                  </NavigationMenuLink>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* Home link */}
      <Button asChild variant="none" size="sm" className={navLinkClass}>
        <NextLink href="/" prefetch>
          Home
        </NextLink>
      </Button>
    </div>
  );
}
