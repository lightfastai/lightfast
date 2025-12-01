import Link from "~/components/ui/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppNavMenu } from "./app-nav-menu";

/**
 * Server-rendered navbar component
 */
export function AppNavbar() {
  return (
    <header className="shrink-0 border-b sticky top-0 z-50 py-2 page-gutter bg-background transition-colors duration-300">
      <div className="relative flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center md:justify-self-start">
          <Button variant="none" size="lg" className="group" asChild>
            <Link href="/">
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </Link>
          </Button>
        </div>

        {/* Center: Nav items */}
        <AppNavMenu />

        {/* Right: Actions */}
        <div className="flex items-center gap-4 md:justify-self-end">
          {/* Search Icon */}
          <Button
            variant="link"
            size="lg"
            asChild
            className="text-muted-foreground"
          >
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
            <Link href="/sign-in" microfrontend>
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
