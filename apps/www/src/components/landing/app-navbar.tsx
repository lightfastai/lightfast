"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";

/**
 * AppNavbar - Main navigation tabs for the marketing site
 *
 * Displays tab-based navigation for main sections:
 * - Home, Pricing, Updates, Docs
 *
 * Features:
 * - Automatic active tab detection based on current pathname
 * - Consistent styling with design system
 *
 * @example
 * ```tsx
 * <AppNavbar />
 * ```
 */
export function AppNavbar() {
  const pathname = usePathname();

  /**
   * Maps the current pathname to the corresponding tab value
   *
   * @returns {string} The active tab identifier ("home" | "pricing" | "updates" | "docs")
   *
   * Tab Mapping:
   * - "/" → "home"
   * - "/pricing" → "pricing"
   * - "/updates" → "updates"
   * - "/docs" → "docs"
   * - fallback → "home"
   */
  const getActiveTab = () => {
    if (pathname === "/") return "home";
    if (pathname === "/pricing") return "pricing";
    if (pathname === "/updates") return "updates";
    if (pathname.startsWith("/docs")) return "docs";
    return "home";
  };

  return (
    <nav className="flex flex-row items-center gap-4">
      {/* Main navigation tabs - Home, Pricing, Updates, Docs */}
      <Tabs value={getActiveTab()}>
        <TabsList>
          <TabsTrigger value="home" asChild>
            <Link href="/">Home</Link>
          </TabsTrigger>

          <TabsTrigger value="pricing" asChild>
            <Link href="/pricing">Pricing</Link>
          </TabsTrigger>

          <TabsTrigger value="updates" asChild>
            <Link href="/updates">Updates</Link>
          </TabsTrigger>

          <TabsTrigger value="docs" asChild>
            <Link href="/docs">Docs</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </nav>
  );
}
