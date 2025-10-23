"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { useNavigationOverlay } from "./landing/navigation-overlay-provider";
import { LightfastSineWaveMatrix } from "./landing/lightfast-sine-wave-matrix";
import { exposureTrial } from "~/lib/fonts";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/updates", label: "Updates" },
  { href: "/docs", label: "Docs" },
  { href: "/early-access", label: "Early Access" },
] as const;

/**
 * MarketingSidebar - Sidebar navigation for the marketing site
 *
 * Features:
 * - Logo in header
 * - Vertical navigation with active state
 * - Matrix animation in footer
 * - Integrates with navigation overlay for manifesto transitions
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <MarketingSidebar />
 *   <SidebarInset>
 *     <main>{children}</main>
 *   </SidebarInset>
 * </SidebarProvider>
 * ```
 */
export function MarketingSidebar() {
  const pathname = usePathname();
  const { navigateFromManifesto } = useNavigationOverlay();

  /**
   * Handle navigation click
   * Intercepts navigation when leaving manifesto page
   */
  const handleNavClick = (route: string) => (e: React.MouseEvent) => {
    // If on manifesto page, trigger reverse animation
    if (pathname === "/manifesto") {
      e.preventDefault();
      navigateFromManifesto(route);
      return;
    }
    // Otherwise, allow normal navigation via Link
  };

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="header-only"
      className="border-0 pl-16 ![border-right:0]"
    >
      {/* Header with Logo and Sidebar Trigger */}
      <SidebarHeader className="flex flex-row items-center gap-2 py-4 px-0">
        <div className="-ml-2 flex items-center">
          <Button
            variant="ghost"
            size="lg"
            className="hover:bg-black group"
            asChild
          >
            <Link href="/" onClick={handleNavClick("/")}>
              <Icons.logo className="size-22 text-foreground group-hover:text-white transition-colors" />
            </Link>
          </Button>
        </div>
        <SidebarTrigger />
      </SidebarHeader>

      {/* Navigation Content with Matrix at top */}
      <SidebarContent className="pt-[20vh] pb-8 px-0">
        <SidebarGroup className="px-0">
          <SidebarGroupContent className="px-0">
            {/* Matrix Animation */}
            <div className="mb-8">
              <LightfastSineWaveMatrix />
            </div>

            {/* Navigation Menu */}
            <SidebarMenu className="gap-3">
              {NAV_ITEMS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <SidebarMenuItem key={link.href} className="relative">
                    {isActive && (
                      <ChevronRight className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground" />
                    )}
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`h-auto p-0 text-3xl font-light bg-transparent hover:bg-transparent hover:opacity-60 data-[active=true]:bg-transparent data-[active=true]:font-light justify-start ${exposureTrial.className}`}
                    >
                      <Link
                        href={link.href}
                        onClick={handleNavClick(link.href)}
                      >
                        {link.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
