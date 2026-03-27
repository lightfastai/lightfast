"use client";

import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Category {
  slug: string;
  title: string;
}

interface CategoryNavProps {
  categories: Category[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const pathname = usePathname();

  // Extract category from pathname if on a category page
  const currentCategory = /\/blog\/topic\/([^/]+)/.exec(pathname)?.[1];
  const isHomePage = pathname === "/blog" || pathname === "/blog/";

  return (
    <aside className="w-48 flex-shrink-0">
      <nav className="space-y-1">
        <Button
          asChild
          className={`h-auto h-fit w-full justify-start px-0 py-1 font-normal ${
            isHomePage ? "text-foreground" : "text-muted-foreground"
          }`}
          size="sm"
          variant="link"
        >
          <Link href="/blog">All Posts</Link>
        </Button>
        {categories.map((category) => (
          <Button
            asChild
            className={`h-auto h-fit w-full justify-start px-0 py-1 font-normal ${
              currentCategory === category.slug
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
            key={category.slug}
            size="sm"
            variant="link"
          >
            <Link href={`/blog/topic/${category.slug}`}>{category.title}</Link>
          </Button>
        ))}
      </nav>
    </aside>
  );
}
