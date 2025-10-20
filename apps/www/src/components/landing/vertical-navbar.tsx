"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Research", href: "/research" },
  { label: "Release", href: "/release" },
  { label: "Login", href: "/login" },
];

export function VerticalNavbar() {
  return (
    <nav className="flex flex-col gap-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            "whitespace-nowrap"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
