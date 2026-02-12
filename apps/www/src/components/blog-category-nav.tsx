"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";

interface Category {
  _slug?: string | null;
  _title?: string | null;
}

interface CategoryNavProps {
  categories: Category[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  const pathname = usePathname();

  // Extract category from pathname if on a category page
  const currentCategory = pathname.match(/\/blog\/topic\/([^/]+)/)?.[1];
  const isHomePage = pathname === "/blog" || pathname === "/blog/";

  return (
    <aside className="w-48 flex-shrink-0">
      <nav className="space-y-1">
        <Button
          variant="link"
          size="sm"
          asChild
          className={`w-full justify-start py-1 h-fit h-auto font-normal ${
            isHomePage ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Link href="/blog">All Posts</Link>
        </Button>
        {categories.map((category) => (
          <Button
            key={category._slug}
            variant="link"
            size="sm"
            asChild
            className={`w-full justify-start py-1 h-fit h-auto font-normal ${
              currentCategory === category._slug
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Link href={`/blog/topic/${category._slug}`}>
              {category._title}
            </Link>
          </Button>
        ))}
      </nav>
    </aside>
  );
}

