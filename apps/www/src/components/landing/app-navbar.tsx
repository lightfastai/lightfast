"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollText, X } from "lucide-react";
import { useNavigationOverlay } from "./navigation-overlay-provider";

/**
 * AppNavbar - Main navigation tabs for the marketing site
 *
 * Displays tab-based navigation for main sections:
 * - Home, Pricing, Updates, Docs
 *
 * Features:
 * - Automatic active tab detection based on current pathname
 * - Consistent styling with design system
 * - Animated transition to manifesto page
 *
 * @example
 * ```tsx
 * <AppNavbar />
 * ```
 */
export function AppNavbar() {
  const pathname = usePathname();
  const { navigateToManifesto, navigateFromManifesto } = useNavigationOverlay();

  /**
   * Maps the current pathname to the corresponding tab value
   *
   * @returns {string} The active tab identifier ("home" | "pricing" | "updates" | "docs" | "")
   *
   * Tab Mapping:
   * - "/" → "home"
   * - "/pricing" → "pricing"
   * - "/updates" → "updates"
   * - "/docs" → "docs"
   * - "/manifesto" → "" (no selection)
   * - fallback → "home"
   */
  const getActiveTab = () => {
    if (pathname === "/") return "home";
    if (pathname === "/pricing") return "pricing";
    if (pathname === "/updates") return "updates";
    if (pathname.startsWith("/docs")) return "docs";
    if (pathname === "/manifesto") return "";
    return "home";
  };

  /**
   * Handle tab click
   * Intercepts navigation when leaving manifesto page
   */
  const handleTabClick = (route: string) => (e: React.MouseEvent) => {
    // If on manifesto page, trigger reverse animation
    if (pathname === "/manifesto") {
      e.preventDefault();
      navigateFromManifesto(route);
      return;
    }
    // Otherwise, allow normal navigation via Link
  };

  /**
   * Handle manifesto button click
   * Triggers animation when navigating TO manifesto page
   */
  const handleManifestoClick = (e: React.MouseEvent) => {
    // If already on manifesto, trigger reverse animation to home
    if (pathname === "/manifesto") {
      e.preventDefault();
      navigateFromManifesto("/");
      return;
    }

    // Prevent default navigation and trigger forward animation
    e.preventDefault();
    navigateToManifesto();
  };

  return (
    <>
      <nav className="flex flex-row items-center gap-4">
        {/* Main navigation tabs - Home, Pricing, Updates, Docs */}
        <Tabs value={getActiveTab()}>
          <TabsList>
            <TabsTrigger value="home" asChild>
              <Link href="/" onClick={handleTabClick("/")}>
                Home
              </Link>
            </TabsTrigger>

            <TabsTrigger value="pricing" asChild>
              <Link href="/pricing" onClick={handleTabClick("/pricing")}>
                Pricing
              </Link>
            </TabsTrigger>

            <TabsTrigger value="updates" asChild>
              <Link href="/updates" onClick={handleTabClick("/updates")}>
                Updates
              </Link>
            </TabsTrigger>

            <TabsTrigger value="docs" asChild>
              <Link href="/docs" onClick={handleTabClick("/docs")}>
                Docs
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Manifesto button - separate from tabs */}
        <Button
          variant={"secondary"}
          size={"lg"}
          onClick={handleManifestoClick}
          className="text-foreground"
        >
          {pathname === "/manifesto" ? (
            <X className="h-4 w-4" />
          ) : (
            <ScrollText className="h-4 w-4" />
          )}
        </Button>
      </nav>
    </>
  );
}
