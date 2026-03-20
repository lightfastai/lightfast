import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import NextLink from "next/link";
import { AppMobileNavLazy } from "./app-mobile-nav-lazy";
import { AppNavbarMenu } from "./app-navbar-menu";

/**
 * Server-rendered navbar component
 * Centered nav pill with logo and navigation items
 */
export function AppNavbar() {
  return (
    <div
      className="page-gutter shrink-0 border-border border-b bg-background py-4 md:border-b-0 md:bg-transparent"
      id="app-navbar"
    >
      {/* Centered nav container */}
      <div className="relative flex items-center justify-center">
        {/* Desktop: Centered nav pill */}
        <nav className="relative hidden h-9 items-center gap-0.5 rounded-md py-1 pr-1 pl-4 md:flex">
          {/* Glass backdrop layer - sibling so dropdown's backdrop-blur isn't trapped */}
          <div className="absolute inset-0 -z-10 rounded-md border border-border/50 bg-card/40 backdrop-blur-md" />
          {/* Logo */}
          <NextLink
            className="mr-auto flex items-center pr-4"
            href="/"
            prefetch
          >
            <Icons.logoShort className="h-4 w-4 text-foreground/60 transition-colors hover:text-foreground" />
          </NextLink>

          {/* Nav items */}
          <AppNavbarMenu />

          {/* Join Early Access Button */}
          <Button asChild className="ml-1" size="sm">
            <MicrofrontendLink href="/early-access">
              Join Early Access
            </MicrofrontendLink>
          </Button>
        </nav>

        {/* Mobile: Logo left, hamburger right */}
        <div className="flex w-full items-center justify-between md:hidden">
          <NextLink
            className="flex items-center transition-opacity hover:opacity-80"
            href="/"
            prefetch
          >
            <Icons.logoShort className="h-4 w-4 text-foreground" />
          </NextLink>
          <AppMobileNavLazy />
        </div>
      </div>
    </div>
  );
}
