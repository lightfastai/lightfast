"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@repo/ui/components/ui/navigation-menu";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import NextLink from "next/link";
import { INTERNAL_NAV, RESOURCES_NAV } from "~/config/nav";

const navLinkClass =
  "text-foreground/60 hover:text-foreground transition-colors" as const;

/**
 * Client-rendered navigation menu component
 */
export function AppNavbarMenu() {
  return (
    <div className="flex items-center gap-0.5">
      {/* Resources dropdown */}
      <NavigationMenu className="[&>div]:!static static" viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem className="static">
            <NavigationMenuTrigger
              className={`rounded bg-transparent px-1.5 text-sm hover:bg-transparent hover:text-foreground focus:bg-transparent focus:text-foreground data-[state=open]:bg-transparent data-[state=open]:text-foreground dark:data-[state=open]:bg-transparent dark:data-[state=open]:text-foreground dark:focus:bg-transparent dark:focus:text-foreground dark:hover:bg-transparent dark:hover:text-foreground ${navLinkClass}`}
            >
              Resources
            </NavigationMenuTrigger>
            <NavigationMenuContent className="right-0 left-0 w-full md:w-full">
              <div className="flex flex-col gap-1 rounded-sm">
                {RESOURCES_NAV.map((item) => (
                  <NavigationMenuLink asChild key={item.href}>
                    {item.microfrontend ? (
                      <MicrofrontendLink href={item.href} prefetch={true}>
                        {item.title}
                      </MicrofrontendLink>
                    ) : (
                      <NextLink href={item.href} prefetch>
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

      {/* Flat nav items (Pricing, Docs) */}
      {INTERNAL_NAV.filter((i) => i.href !== "/early-access").map((item) =>
        item.microfrontend ? (
          <Button
            asChild
            className={navLinkClass}
            key={item.href}
            size="sm"
            variant="none"
          >
            <MicrofrontendLink href={item.href} prefetch={true}>{item.title}</MicrofrontendLink>
          </Button>
        ) : (
          <Button
            asChild
            className={navLinkClass}
            key={item.href}
            size="sm"
            variant="none"
          >
            <NextLink href={item.href} prefetch>
              {item.title}
            </NextLink>
          </Button>
        )
      )}

      {/* Sign In Link */}
      <Button asChild className={navLinkClass} size="sm" variant="none">
        <MicrofrontendLink href="/sign-in" prefetch={true}>Sign in</MicrofrontendLink>
      </Button>
    </div>
  );
}
