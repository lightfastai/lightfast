import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppMobileNav } from "./app-mobile-nav";
import { INTERNAL_NAV, FEATURES_NAV, RESOURCES_NAV } from "~/config/nav";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";

/**
 * Server-rendered navbar component (v2)
 * Clean horizontal layout with logo + text on left, nav items + actions on right
 */
export function AppNavbarV2() {
  return (
    <div id="app-navbar" className="shrink-0 py-4 page-gutter bg-transparent">
      {/* Content container */}
      <div className="relative flex items-center justify-between">
        {/* Left: Logo */}
        <NextLink
          href="/"
          prefetch
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <Icons.logo className="size-22 h-4 text-foreground transition-colors" />
        </NextLink>

        {/* Right: Nav items + Actions */}
        <nav className="hidden lg:flex items-center group gap-1 rounded-md bg-white/80 px-1 py-1">
          {/* Features dropdown */}
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-medium text-black rounded-sm transition-opacity group-hover:opacity-60 hover:!opacity-100">
                  Features
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                    {FEATURES_NAV.map((item) => (
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

          {/* Resources dropdown */}
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-sm font-medium text-black rounded-sm transition-opacity group-hover:opacity-60 hover:!opacity-100">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                    {RESOURCES_NAV.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        {item.microfrontend ? (
                          <MicrofrontendLink href={item.href}>
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
          {INTERNAL_NAV.filter(
            (i) => i.href !== "/features" && i.href !== "/early-access",
          ).map((item) =>
            item.microfrontend ? (
              <MicrofrontendLink
                key={item.href}
                href={item.href}
                className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium text-black rounded-sm transition-opacity group-hover:opacity-60 hover:!opacity-100"
              >
                {item.title}
              </MicrofrontendLink>
            ) : (
              <NextLink
                key={item.href}
                href={item.href}
                prefetch
                className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium text-black rounded-sm transition-opacity group-hover:opacity-60 hover:!opacity-100"
              >
                {item.title}
              </NextLink>
            ),
          )}

          {/* Search Icon */}
          <Button
            variant="link"
            size="sm"
            asChild
            className="h-8 min-w-8 px-3 text-black transition-opacity group-hover:opacity-60 hover:!opacity-100"
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          {/* Sign In Link */}
          <MicrofrontendLink
            href="/sign-in"
            className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium text-black rounded-sm transition-opacity group-hover:opacity-60 hover:!opacity-100"
          >
            Sign in
          </MicrofrontendLink>

          {/* Join Early Access Button */}
          <NextLink
            href="/early-access"
            prefetch
            className="inline-flex items-center justify-center h-8 px-3 rounded-sm bg-brand-blue text-sm font-medium text-white transition-all hover:bg-black hover:text-white"
          >
            Join Early Access
          </NextLink>
        </nav>

        {/* Mobile: Search + Sign In + Join Early Access + Nav Trigger */}
        <div className="flex lg:hidden items-center gap-1 rounded-md bg-white/80 px-1 py-1">
          <Button
            variant="link"
            size="sm"
            asChild
            className="h-8 min-w-8 px-2 text-black"
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          <MicrofrontendLink
            href="/sign-in"
            className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium text-black rounded-sm"
          >
            Sign in
          </MicrofrontendLink>

          <NextLink
            href="/early-access"
            prefetch
            className="inline-flex items-center justify-center h-8 px-3 rounded-sm bg-brand-blue text-sm font-medium text-white transition-all hover:bg-black hover:text-white"
          >
            Join Early Access
          </NextLink>

          <AppMobileNav />
        </div>
      </div>
    </div>
  );
}
