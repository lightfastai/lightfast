"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

/**
 * DocsHeaderNav - Client component for docs header navigation
 *
 * Handles:
 * - Active state based on current pathname
 * - Navigation between Docs and API sections
 */
export function DocsHeaderNav() {
  const pathname = usePathname();

  // Check if we're in the API section
  const isApiActive = pathname.startsWith("/docs/api-reference");
  // Check if we're in the Docs section (but not API)
  const isDocsActive = pathname.startsWith("/docs") && !isApiActive;

  return (
    <nav className="flex items-center gap-6">
      <Link
        href="/docs/get-started/overview"
        className={cn(
          "text-sm font-medium transition-colors hover:text-foreground",
          isDocsActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        Docs
      </Link>
      <Link
        href="/docs/api-reference/overview"
        className={cn(
          "text-sm font-medium transition-colors hover:text-foreground",
          isApiActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        API
      </Link>
    </nav>
  );
}

