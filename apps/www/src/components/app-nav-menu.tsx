"use client";

import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Button } from "@repo/ui/components/ui/button";
import { INTERNAL_NAV, RESOURCES_NAV } from "~/config/nav";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";

/**
 * Client-rendered navigation menu component
 */
export function AppNavMenu() {
  return (
    <nav className="hidden md:flex items-center md:justify-self-center">
      {/* Resources dropdown */}
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="text-muted-foreground">
              Resources
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                {RESOURCES_NAV.map((item) => (
                  <NavigationMenuLink asChild key={item.href}>
                    {item.microfrontend ? (
                      <MicrofrontendLink href={item.href} className="text--foreground">
                        {item.title}
                      </MicrofrontendLink>
                    ) : (
                      <NextLink href={item.href} prefetch className="text--foreground">
                        {item.title}
                      </NextLink>
                    )}
                  </NavigationMenuLink>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* Remaining top-level nav items (Pricing, Early Access, Docs) */}
      {INTERNAL_NAV.filter((i) => i.href !== "/features").map((item) => (
        <Button
          key={item.href}
          variant="ghost"
          className="text-muted-foreground"
          asChild
        >
          {item.microfrontend ? (
            <MicrofrontendLink href={item.href}>
              {item.title}
            </MicrofrontendLink>
          ) : (
            <NextLink href={item.href} prefetch>
              {item.title}
            </NextLink>
          )}
        </Button>
      ))}
    </nav>
  );
}
