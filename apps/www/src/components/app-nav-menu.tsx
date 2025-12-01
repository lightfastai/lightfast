"use client";

import Link from "~/components/ui/link";
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
                    <Link
                      href={item.href}
                      microfrontend={item.microfrontend}
                      className="text--foreground"
                    >
                      {item.title}
                    </Link>
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
          <Link href={item.href} microfrontend={item.microfrontend}>
            {item.title}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
