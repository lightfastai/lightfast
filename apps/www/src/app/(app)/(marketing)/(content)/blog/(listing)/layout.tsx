import { categories as categoriesAPI } from "@vendor/cms";
import { CategoryNav } from "~/components/blog-category-nav";
import { RssIcon } from "lucide-react";
import Link from "next/link";

export default async function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allCategories = await categoriesAPI.getCategories();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pt-24 pb-32">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-pp text-foreground font-medium">Blog</h1>
        <Link
          href="/blog/feed.xml"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </Link>
      </div>

      <div className="relative">
        {/* Desktop: Category nav positioned to the left of content */}
        <div className="hidden xl:block absolute right-full mr-12 top-0">
          <CategoryNav categories={allCategories} />
        </div>

        {/* Mobile/tablet: Category nav above content */}
        <div className="xl:hidden mb-8">
          <CategoryNav categories={allCategories} />
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}
