"use client";

import { usePathname } from "next/navigation";
import Link from "~/components/ui/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";
import { Search } from "lucide-react";
import { authUrl } from "~/lib/related-projects";
import { INTERNAL_NAV, RESOURCES_NAV, FEATURES_NAV } from "~/config/nav";

export function MarketingNavbar() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <header
      className={`group ${isHomePage ? "brand-navbar group-has-[.nav-trigger:hover]:dark group-has-[.nav-trigger[data-state=open]]:dark" : ""} shrink-0 fixed top-0 left-0 right-0 z-50 py-4 page-gutter`}
    >
      {/* Brand blue background - only on home page */}
      {isHomePage && (
        <div
          className="absolute inset-0 bg-[var(--brand-blue)]"
          aria-hidden="true"
        />
      )}

      {/* Dark background that slides down on hover and when menu is open - only on home page */}
      {isHomePage && (
        <div
          className="absolute inset-0 bg-black -translate-y-full group-has-[.nav-trigger:hover]:translate-y-0 group-has-[.nav-trigger[data-state=open]]:translate-y-0 transition-transform duration-300 ease-out"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center md:justify-self-start">
          <Button variant="ghost" size="lg" className="group" asChild>
            <Link href="/">
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </Link>
          </Button>
        </div>

        {/* Center: Nav items */}
        <nav className="hidden md:flex items-center md:justify-self-center">
          {/* Features dropdown disabled */}
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="nav-trigger text-foreground">
                  Features
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                    {FEATURES_NAV.map((feature) => (
                      <NavigationMenuLink asChild key={feature.href}>
                        <Link
                          href={feature.href}
                          microfrontend={feature.microfrontend}
                          className="text-popover-foreground"
                        >
                          {feature.title}
                        </Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              {/* Resources dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="nav-trigger text-foreground">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                    {RESOURCES_NAV.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          microfrontend={item.microfrontend}
                          className="text-popover-foreground"
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

          {/* Remaining top-level items */}
          {INTERNAL_NAV.filter((i) => i.href !== "/features").map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className="nav-trigger text-foreground"
              asChild
            >
              <Link href={item.href} microfrontend={item.microfrontend}>
                {item.title}
              </Link>
            </Button>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 md:justify-self-end">
          {/* Search Icon */}
          <Button variant="link" size="lg" asChild>
            <Link href="/search" microfrontend aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          {/* Sign In Button */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full"
            asChild
          >
            <Link href={`${authUrl}/sign-in`}>
              <span className="text-sm text-secondary-foreground font-medium">
                Log In
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
