"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@repo/ui/lib/utils";

import { Icons } from "~/app/icons";
import { siteConfig } from "~/config/site";

export const MainNav = () => {
  const pathname = usePathname();

  return (
    <div className="mr-4 hidden h-full items-center gap-4 md:flex">
      <div className="flex h-full w-14 items-center justify-center border-r">
        <Link href="/">
          <Icons.logo className="h-6 w-6" />
        </Link>
      </div>

      <span className="hidden font-mono font-bold lowercase tracking-widest lg:inline-block">
        {siteConfig.name}
      </span>

      <nav className="flex items-center gap-4 text-sm lg:gap-6">
        <Link
          href="/playground"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/playground"
              ? "text-foreground"
              : "text-foreground/60",
          )}
        >
          Playground
        </Link>

        <Link
          href="/docs/introduction"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname.startsWith("/docs")
              ? "text-foreground"
              : "text-foreground/60",
          )}
        >
          Docs
        </Link>
      </nav>
    </div>
  );
};
