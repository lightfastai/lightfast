import { RssIcon } from "lucide-react";
import type { Route } from "next";
import { BlogCategoryDropdown } from "~/app/(app)/_components/blog-category-dropdown";
import { NavLink } from "~/components/nav-link";
import { BlogPostSchema } from "~/lib/content-schemas";

interface BlogListingHeaderProps {
  tagline?: string;
  title: string;
}

const BLOG_CATEGORIES = BlogPostSchema.shape.category.options.map((slug) => ({
  slug,
  title: slug.charAt(0).toUpperCase() + slug.slice(1),
}));

export function BlogListingHeader({ title, tagline }: BlogListingHeaderProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          {title}
        </h1>
        <NavLink
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href={"/blog/feed.xml" as Route}
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </NavLink>
      </div>
      {tagline && (
        <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
          {tagline}
        </p>
      )}
      <div className="mt-6 xl:hidden">
        <BlogCategoryDropdown categories={BLOG_CATEGORIES} />
      </div>
    </div>
  );
}
