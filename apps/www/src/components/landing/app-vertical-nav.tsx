"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useNavigationOverlay } from "./navigation-overlay-provider";
import { exposureTrial } from "~/lib/fonts";

/**
 * AppVerticalNav - Vertical navigation for the marketing site
 *
 * Displays navigation links vertically in the sidebar:
 * - Home, Pricing, Updates, Docs, Early Access
 *
 * Features:
 * - Automatic active link detection based on current pathname
 * - Consistent styling with design system
 * - Handles navigation from manifesto page with animations
 *
 * @example
 * ```tsx
 * <AppVerticalNav />
 * ```
 */
export function AppVerticalNav() {
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

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/updates", label: "Updates" },
    { href: "/docs", label: "Docs" },
    { href: "/early-access", label: "Early Access" },
  ];

  return (
    <nav className="flex flex-col gap-3">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        return (
          <div key={link.href} className="relative">
            {isActive && (
              <ChevronRight className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-foreground" />
            )}
            <Link
              href={link.href}
              onClick={handleNavClick(link.href)}
              className={`block font-light text-3xl text-foreground transition-opacity hover:opacity-60 ${exposureTrial.className}`}
            >
              {link.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
