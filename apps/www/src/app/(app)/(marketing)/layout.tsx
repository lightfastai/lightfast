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
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { SiteFooter } from "~/components/landing/footer-section";
import { authUrl } from "~/lib/related-projects";
import { INTERNAL_NAV, RESOURCES_NAV, FEATURES_NAV } from "~/config/nav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark w-full bg-background min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="shrink-0 fixed top-0 left-0 right-0 z-50 py-4 page-gutter bg-background">
        <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Logo */}
          <div className="-ml-2 flex items-center md:justify-self-start">
            <Button
              variant="ghost"
              size="lg"
              className="hover:bg-black group"
              asChild
            >
              <Link href="/">
                <Icons.logo className="size-22 text-foreground group-hover:text-white transition-colors" />
              </Link>
            </Button>
          </div>

          {/* Center: Nav items */}
          <nav className="hidden md:flex items-center md:justify-self-center">
            {/* Features dropdown disabled */}
            <NavigationMenu viewport={false}>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Features</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                      {FEATURES_NAV.map((feature) => (
                        <NavigationMenuLink asChild key={feature.href}>
                          <Link
                            href={feature.href}
                            microfrontend={feature.microfrontend}
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
                  <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                      {RESOURCES_NAV.map((item) => (
                        <NavigationMenuLink asChild key={item.href}>
                          <Link
                            href={item.href}
                            microfrontend={item.microfrontend}
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
              <Button key={item.href} variant="ghost" asChild>
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
                <span className="text-sm text-foreground font-medium">
                  Log In
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Spacer to offset fixed navbar height */}
      <div aria-hidden className="shrink-0 h-16 md:h-20" />

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="page-gutter py-12">
          {/* Page Content */}
          <main className="min-w-0">{children}</main>

          {/* Shared footer sections for all marketing pages */}
          {/* Centered Waitlist Section */}
          <div className="bg-background pt-16 pb-36">
            <div className="max-w-2xl mx-auto">
              <CenteredWaitlistSection />
            </div>
          </div>

          {/* Ready to Orchestrate Section */}
          <div className="bg-background py-16">
            <ReadyToOrchestrateSection />
          </div>

          {/* Footer Section */}
          <div className="bg-background px-20 py-12 sm:py-16 lg:py-24">
            <SiteFooter />
          </div>
        </div>
      </div>
    </div>
  );
}
