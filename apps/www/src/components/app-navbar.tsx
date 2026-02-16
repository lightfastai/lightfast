import NextLink from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { AppMobileNav } from "./app-mobile-nav";
import { AppNavbarMenu } from "./app-navbar-menu";

/**
 * Server-rendered navbar component
 * Centered nav pill with logo and navigation items
 */
export function AppNavbar() {
  return (
    <div id="app-navbar" className="shrink-0 py-4 page-gutter bg-transparent">
      {/* Centered nav container */}
      <div className="relative flex items-center justify-center">
        {/* Desktop: Centered nav pill */}
        <nav className="hidden md:flex relative h-9 items-center gap-0.5 rounded-md pl-4 pr-1 py-1">
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

          {/* Nav items */}
          <AppNavbarMenu />

          {/* Join Early Access Button */}
          <Button asChild size="sm" className="ml-1">
            <NextLink href="/early-access" prefetch>
              Join Early Access
            </NextLink>
          </Button>
        </nav>

        {/* Mobile: Logo left, hamburger right */}
        <div className="flex md:hidden items-center justify-between w-full">
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
