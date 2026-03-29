import { RssIcon } from "lucide-react";
import type { Route } from "next";
import { CategoryNav } from "~/app/(app)/_components/blog-category-nav";
import { NavLink } from "~/components/nav-link";
import { BlogPostSchema } from "~/lib/content-schemas";

// Derived from the Zod enum — single source of truth in content-schemas.ts
const BLOG_CATEGORIES = BlogPostSchema.shape.category.options.map((slug) => ({
  slug,
  title: slug.charAt(0).toUpperCase() + slug.slice(1),
}));

export default function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl pt-24 pb-32">
      <div className="mb-12 flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">Blog</h1>
        <NavLink
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href={"/blog/feed.xml" as Route}
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </NavLink>
      </div>

      <div className="relative">
        {/* Desktop: Category nav positioned to the left of content */}
        <div className="absolute top-0 right-full mr-12 hidden xl:block">
          <CategoryNav categories={BLOG_CATEGORIES} />
        </div>

        {/* Mobile/tablet: Category nav above content */}
        <div className="mb-8 xl:hidden">
          <CategoryNav categories={BLOG_CATEGORIES} />
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}
