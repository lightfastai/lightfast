"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icons } from "~/app/icons";
import { siteConfig } from "~/config/site";

export const MainNav = () => {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-row items-center gap-4">
      <Link href="/" className="flex flex-row items-center gap-4">
        <Icons.logo className="h-6 w-6" />
        <span className="font-bold tracking-widest">{siteConfig.name}</span>
      </Link>

      {/* <nav className="flex items-center gap-4 text-sm lg:gap-6">
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
      </nav> */}
    </div>
  );
};
