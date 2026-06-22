"use client";

import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import { cn } from "@repo/ui-v2/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Company } from "./company";

export function Sidebar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isBrand = pathname === "/brand";
  const navItemClassName =
    "h-auto justify-start px-0 py-0 font-normal text-sm leading-none transition-colors hover:text-foreground hover:no-underline";

  return (
    <aside className="fixed top-0 right-0 left-0 z-50 border-border border-b bg-background px-6 py-4 text-foreground lg:right-auto lg:bottom-0 lg:w-48 lg:border-b-0 lg:bg-transparent lg:px-8 lg:py-8">
      <nav
        aria-label="Primary navigation"
        className="flex items-center justify-between gap-8 lg:h-full lg:flex-col lg:items-start lg:justify-start lg:gap-0"
      >
        <Link
          aria-label="Lightfast home"
          className="shrink-0 text-foreground transition-colors hover:text-muted-foreground lg:flex lg:h-16 lg:items-start"
          href="/"
        >
          <Logo showWordmark={false} size="sm" />
        </Link>

        <div className="flex items-center gap-6 text-muted-foreground text-sm leading-none lg:flex-col lg:items-start lg:gap-3">
          <Button
            aria-current={isHome ? "page" : undefined}
            className={cn(
              navItemClassName,
              isHome ? "text-foreground" : "text-muted-foreground"
            )}
            nativeButton={false}
            render={<Link href="/" />}
            variant="link"
          >
            Home
          </Button>
          <Company className={cn(navItemClassName, "text-muted-foreground")}>
            Company
          </Company>
          <Button
            aria-current={isBrand ? "page" : undefined}
            className={cn(
              navItemClassName,
              isBrand ? "text-foreground" : "text-muted-foreground"
            )}
            nativeButton={false}
            render={<Link href="/brand" />}
            variant="link"
          >
            Brand
          </Button>
        </div>
      </nav>
    </aside>
  );
}
