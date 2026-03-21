import { categories as categoriesAPI } from "@vendor/cms";
import { RssIcon } from "lucide-react";
import Link from "next/link";
import { CategoryNav } from "~/app/(app)/_components/blog-category-nav";

export default async function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allCategories = await categoriesAPI.getCategories();

  return (
    <div className="mx-auto w-full max-w-2xl pt-24 pb-32">
      <div className="mb-12 flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">Blog</h1>
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/blog/feed.xml"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </Link>
      </div>

      <div className="relative">
        {/* Desktop: Category nav positioned to the left of content */}
        <div className="absolute top-0 right-full mr-12 hidden xl:block">
          <CategoryNav categories={allCategories} />
        </div>

        {/* Mobile/tablet: Category nav above content */}
        <div className="mb-8 xl:hidden">
          <CategoryNav categories={allCategories} />
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}
