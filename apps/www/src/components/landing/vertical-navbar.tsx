"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";

export function VerticalNavbar() {
  return (
    <nav className="flex flex-row items-center gap-8 border border-muted px-1 py-1 rounded-md backdrop-blur-sm">
      <Link
        href="/pricing"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
      >
        Pricing
      </Link>

      <Link
        href="/blog"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
      >
        Blog
      </Link>

      <Link
        href="/updates"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
      >
        Updates
      </Link>

      <Link
        href="/sign-in"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
      >
        Sign In
      </Link>

      <Button asChild size="sm" className="rounded-sm">
        <Link href="/early-access">Join Early Access</Link>
      </Button>
    </nav>
  );
}
