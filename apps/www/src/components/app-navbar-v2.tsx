import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppNavMenu } from "./app-nav-menu";
import { AppMobileNav } from "./app-mobile-nav";

/**
 * Server-rendered navbar component (v2)
 * Transforms to compact floating bar on scroll (desktop only)
 * Uses translate transforms for smooth animation
 */
export function AppNavbarV2() {
  return (
    <header
      id="app-navbar"
      className="group shrink-0 sticky top-0 z-50 py-4 page-gutter transition-all duration-300
        bg-background lg:group-[.brand-navbar]:bg-transparent"
    >
      {/* Background pill that appears on scroll (desktop only) */}
      <div
        className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          h-14 w-full max-w-5xl rounded-sm
          bg-transparent lg:group-[.brand-navbar]:bg-black
          scale-x-0 lg:group-[.brand-navbar]:scale-x-100
          origin-center transition-all duration-300 pointer-events-none"
        aria-hidden="true"
      />

      {/* Content container */}
      <div
        className="relative flex items-center justify-between gap-4
          lg:grid lg:grid-cols-[1fr_auto_1fr]"
      >
        {/* Left: Logo - translates right on scroll */}
        <div
          className="-ml-2 flex items-center lg:justify-self-start
            transition-transform duration-300
            lg:group-[.brand-navbar]:translate-x-[calc((100vw-1024px)/2-1.5rem)]"
        >
          <Button variant="none" size="lg" className="group/logo" asChild>
            <NextLink href="/" prefetch>
              <Icons.logo className="size-22 text-foreground lg:group-[.brand-navbar]:text-white transition-colors" />
            </NextLink>
          </Button>
        </div>

        {/* Center: Nav items */}
        <AppNavMenu />

        {/* Right: Actions - translates left on scroll */}
        <div
          className="flex items-center gap-4 lg:justify-self-end
            transition-transform duration-300
            lg:group-[.brand-navbar]:-translate-x-[calc((100vw-1024px)/2-1.5rem)]"
        >
          {/* Search Icon */}
          <Button
            variant="link"
            size="lg"
            asChild
            className="text-muted-foreground lg:group-[.brand-navbar]:text-white/80 lg:group-[.brand-navbar]:hover:text-white"
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          {/* Sign In Button */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full lg:group-[.brand-navbar]:bg-white lg:group-[.brand-navbar]:text-black"
            asChild
          >
            <MicrofrontendLink href="/sign-in">
              <span className="text-sm text-secondary-foreground font-medium lg:group-[.brand-navbar]:text-black">
                Log In
              </span>
            </MicrofrontendLink>
          </Button>

          {/* Mobile Nav Trigger - only visible below lg */}
          <AppMobileNav />
        </div>
      </div>
    </header>
  );
}
