import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppNavMenu } from "./app-nav-menu";
import { AppMobileNav } from "./app-mobile-nav";

/**
 * Server-rendered navbar component
 */
export function AppNavbar() {
  return (
    <header className="shrink-0 border-b sticky top-0 z-50 py-4 page-gutter bg-background transition-colors duration-300">
      <div className="relative flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center lg:justify-self-start">
          <Button variant="none" size="lg" className="group" asChild>
            <NextLink href="/" prefetch>
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </NextLink>
          </Button>
        </div>

        {/* Center: Nav items */}
        <AppNavMenu />

        {/* Right: Actions */}
        <div className="flex items-center gap-4 lg:justify-self-end">
          {/* Search Icon */}
          <Button
            variant="link"
            size="lg"
            asChild
            className="text-muted-foreground"
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          {/* Sign In Button */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full"
            asChild
          >
            <MicrofrontendLink href="/sign-in">
              <span className="text-sm text-secondary-foreground font-medium">
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
