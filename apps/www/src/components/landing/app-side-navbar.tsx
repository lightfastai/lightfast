"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { authUrl } from "~/lib/related-projects";

/**
 * AppSideNavbar - Secondary navigation component with action buttons
 *
 * Displays action buttons on the top right:
 * - Sign In button (links to auth app)
 * - Join Early Access CTA button
 * - GitHub repository link
 *
 * Features:
 * - Responsive layout with flex row alignment
 * - Consistent styling with design system
 *
 * @example
 * ```tsx
 * <AppSideNavbar />
 * ```
 */
export function AppSideNavbar() {
  return (
    <nav className="flex flex-row items-center gap-4">
      {/* Sign In - Links to auth app via authUrl from ~/lib/related-projects */}
      <Button variant="outline" size="sm" className="text-foreground" asChild>
        <Link href={authUrl}>Sign In</Link>
      </Button>

      {/* Primary CTA - Join Early Access */}
      <Button asChild size="sm">
        <Link href="/early-access">Join Early Access</Link>
      </Button>

      {/* GitHub repository link - Opens in new tab */}
      <Button variant="ghost" size="icon" className="text-foreground" asChild>
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
