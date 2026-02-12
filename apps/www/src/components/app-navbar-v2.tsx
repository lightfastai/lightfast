import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
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
import { Button } from "@repo/ui/components/ui/button";

const navLinkClass =
  "text-foreground/60 hover:text-foreground transition-colors" as const;

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
        <nav className="hidden lg:flex relative h-9 items-center gap-0.5 rounded-md pl-4 pr-1 py-1">
          {/* Glass backdrop layer - sibling so dropdown's backdrop-blur isn't trapped */}
          <div className="absolute inset-0 rounded-md bg-card/40 border border-border/50 backdrop-blur-md -z-10" />
          {/* Logo */}
          <NextLink
            href="/"
            prefetch
            className="flex items-center mr-auto pr-4"
          >
            <Icons.logoShort className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
          </NextLink>
          {/* Nav items container */}
          <div className="flex items-center gap-0.5">
            {/* Resources dropdown */}
            <NavigationMenu viewport={false} className="static [&>div]:!static">
              <NavigationMenuList>
                <NavigationMenuItem className="static">
                  <NavigationMenuTrigger className={`px-1.5 text-sm rounded bg-transparent hover:bg-transparent dark:hover:bg-transparent focus:bg-transparent dark:focus:bg-transparent data-[state=open]:bg-transparent dark:data-[state=open]:bg-transparent hover:text-foreground dark:hover:text-foreground focus:text-foreground dark:focus:text-foreground data-[state=open]:text-foreground dark:data-[state=open]:text-foreground ${navLinkClass}`}>
                    Resources
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="left-0 right-0 w-full md:w-full">
                    <div className="flex flex-col gap-1 rounded-sm">
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
                <Button
                  key={item.href}
                  asChild
                  variant="none"
                  size="sm"
                  className={navLinkClass}
                >
                  <MicrofrontendLink href={item.href}>
                    {item.title}
                  </MicrofrontendLink>
                </Button>
              ) : (
                <Button
                  key={item.href}
                  asChild
                  variant="none"
                  size="sm"
                  className={navLinkClass}
                >
                  <NextLink href={item.href} prefetch>
                    {item.title}
                  </NextLink>
                </Button>
              ),
            )}

            {/* Sign In Link */}
            <Button
              asChild
              size="sm"
              variant="none"
              className={navLinkClass}
            >
              <MicrofrontendLink href="/sign-in">Sign in</MicrofrontendLink>
            </Button>
          </div>

          {/* Join Early Access Button */}
          <Button asChild size="sm" className="ml-1">
            <NextLink href="/early-access" prefetch>
              Join Early Access
            </NextLink>
          </Button>
        </nav>

        {/* Mobile: Logo left, hamburger right */}
        <div className="flex lg:hidden items-center justify-between w-full">
          <NextLink
            href="/"
            prefetch
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <Icons.logoShort className="w-4 h-4 text-foreground" />
          </NextLink>
          <AppMobileNav />
        </div>
      </div>
    </div>
  );
}
