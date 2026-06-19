"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { NavLink } from "~/components/nav-link";

interface Category {
  slug: string;
  title: string;
}

interface BlogCategoryDropdownProps {
  categories: Category[];
}

export function BlogCategoryDropdown({
  categories,
}: BlogCategoryDropdownProps) {
  const pathname = usePathname();
  const currentCategory = /\/blog\/topic\/([^/]+)/.exec(pathname)?.[1];
  const activeLabel =
    categories.find((c) => c.slug === currentCategory)?.title ?? "All Posts";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none">
        <span>Filter: {activeLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        <DropdownMenuItem asChild>
          <NavLink href="/blog">All Posts</NavLink>
        </DropdownMenuItem>
        {categories.map((category) => (
          <DropdownMenuItem asChild key={category.slug}>
            <NavLink href={`/blog/topic/${category.slug}` as Route}>
              {category.title}
            </NavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
