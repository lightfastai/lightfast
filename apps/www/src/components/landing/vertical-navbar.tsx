"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { authUrl } from "~/lib/related-projects";

export function VerticalNavbar() {
  return (
    <nav className="flex flex-row items-center gap-8 border border-muted px-1 py-1 rounded-md backdrop-blur-sm">
      <Link
        href="/pricing"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2 pl-4",
        )}
      >
        Pricing
      </Link>

      <Link
        href="https://github.com/lightfastai/lightfast"
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
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
        href={authUrl}
        className={cn(
          "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          "whitespace-nowrap px-2",
        )}
      >
        Sign In
      </Link>

      <Button
        asChild
        size="sm"
        className="rounded-sm hover:bg-black hover:text-foreground"
      >
        <Link href="/early-access">Join Early Access</Link>
      </Button>
    </nav>
  );
}
