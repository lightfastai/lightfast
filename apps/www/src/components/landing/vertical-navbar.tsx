"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { authUrl } from "~/lib/related-projects";

/**
 * VerticalNavbar - Main navigation component for the marketing site
 *
 * Displays a horizontal navigation bar with:
 * - Tab-based navigation for main sections (Home, Pricing, Updates, Docs)
 * - Sign In button (links to auth app)
 * - Join Early Access CTA button
 * - GitHub repository link
 *
 * Features:
 * - Automatic active tab detection based on current pathname
 * - Responsive layout with flex row alignment
 * - Consistent styling with design system
 *
 * @example
 * ```tsx
 * <VerticalNavbar />
 * ```
 */
export function VerticalNavbar() {
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

      {/* Sign In - Links to auth app via authUrl from ~/lib/related-projects */}
      <Button variant="outline" size="sm" className="text-foreground" asChild>
        <Link href={authUrl}>Sign In</Link>
      </Button>

      {/* Primary CTA - Join Early Access */}
      <Button
        asChild
        size="sm"
        className="rounded-sm hover:bg-black hover:text-white"
      >
        <Link href="/early-access">Join Early Access</Link>
      </Button>

      {/* GitHub repository link - Opens in new tab */}
      <Button variant="ghost" size="icon" className="text-white" asChild>
        <Link
          href="https://github.com/lightfastai/lightfast"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icons.gitHub className="h-5 w-5" />
          <span className="sr-only">GitHub</span>
        </Link>
      </Button>
    </nav>
  );
}
