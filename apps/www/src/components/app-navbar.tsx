import Link from "~/components/ui/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
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
        <nav className="hidden md:flex items-center md:justify-self-center">
          {/* Resources dropdown */}
          <NavigationMenu viewport={false}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger className="text-muted-foreground">
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                    {RESOURCES_NAV.map((item) => (
                      <NavigationMenuLink asChild key={item.href}>
                        <Link
                          href={item.href}
                          microfrontend={item.microfrontend}
                          className="text--foreground"
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

          {/* Remaining top-level nav items (Pricing, Early Access, Docs) */}
          {INTERNAL_NAV.filter((i) => i.href !== "/features").map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className="text-muted-foreground"
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
