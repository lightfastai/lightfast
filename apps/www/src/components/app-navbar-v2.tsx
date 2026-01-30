import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { LightfastLogoLatest } from "~/components/icons";
import { AppMobileNav } from "./app-mobile-nav";
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
 * Server-rendered navbar component (v2)
 * Centered nav pill with logo and navigation items
 */
export function AppNavbarV2() {
  return (
    <div id="app-navbar" className="shrink-0 py-4 page-gutter bg-transparent">
      {/* Centered nav container */}
      <div className="relative flex items-center justify-center">
        {/* Desktop: Centered nav pill */}
        <nav className="hidden lg:flex items-center gap-0.5 rounded-md bg-[var(--nav-pill)] backdrop-blur-md  pl-4 pr-1 py-1">
          {/* Logo */}
          <NextLink
            href="/"
            prefetch
            className="flex items-center mr-auto hover:opacity-80 transition-opacity pr-4"
          >
            <LightfastLogoLatest className="w-4 h-4 text-muted-foreground" />
          </NextLink>
          {/* Nav items container */}
          <div className="flex items-center gap-0.5">
            {/* Resources dropdown */}
            <NavigationMenu viewport={false}>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-[26px] px-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors bg-transparent hover:bg-transparent data-[state=open]:bg-transparent">
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
                  className="inline-flex items-center justify-center h-[26px] px-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  {item.title}
                </MicrofrontendLink>
              ) : (
                <NextLink
                  key={item.href}
                  href={item.href}
                  prefetch
                  className="inline-flex items-center justify-center h-[26px] px-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  {item.title}
                </NextLink>
              ),
            )}

            {/* Sign In Link */}
            <MicrofrontendLink
              href="/sign-in"
              className="inline-flex items-center justify-center h-[26px] px-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
            >
              Sign in
            </MicrofrontendLink>
          </div>

          {/* Join Early Access Button */}
          <NextLink
            href="/early-access"
            prefetch
            className="inline-flex items-center justify-center h-[26px] px-2.5 ml-1 rounded bg-brand-blue hover:bg-brand-blue/90 text-xs text-primary-foreground transition-colors"
          >
            Join Early Access
          </NextLink>
        </nav>

        {/* Mobile: Logo + Sign In + CTA + Nav Trigger */}
        <div className="flex lg:hidden items-center gap-0.5 rounded-md bg-[var(--nav-pill)] backdrop-blur-md  pl-4 pr-1 py-1">
          {/* Logo */}
          <NextLink
            href="/"
            prefetch
            className="flex items-center mr-auto hover:opacity-80 transition-opacity"
          >
            <LightfastLogoLatest className="w-4 h-4 text-foreground" />
          </NextLink>
          {/* Spacer */}
          <div className="w-6" />
          <MicrofrontendLink
            href="/sign-in"
            className="inline-flex items-center justify-center h-[26px] px-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            Sign in
          </MicrofrontendLink>

          <NextLink
            href="/early-access"
            prefetch
            className="inline-flex items-center justify-center h-[26px] px-2.5 rounded bg-brand-blue hover:bg-brand-blue/90 text-xs text-primary-foreground transition-colors"
          >
            Join Early Access
          </NextLink>

          <AppMobileNav />
        </div>
      </div>
    </div>
  );
}
