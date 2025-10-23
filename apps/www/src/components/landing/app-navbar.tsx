"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <nav className="flex flex-row items-center gap-6">
        {/* Main navigation links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            onClick={handleNavClick("/")}
            className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          >
            Home
          </Link>

          <Link
            href="/pricing"
            onClick={handleNavClick("/pricing")}
            className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          >
            Pricing
          </Link>

          <Link
            href="/updates"
            onClick={handleNavClick("/updates")}
            className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          >
            Updates
          </Link>

          <Link
            href="/docs"
            onClick={handleNavClick("/docs")}
            className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
          >
            Docs
          </Link>
        </div>

        {/* Manifesto button */}
        <Button
          variant={"ghost"}
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
