import { exposureTrial } from "~/lib/fonts";
import { categories as categoriesAPI } from "@vendor/cms";
import { CategoryNav } from "~/components/blog-category-nav";
import { DynamicBreadcrumbs } from "~/components/blog-dynamic-breadcrumbs";
import { RssIcon } from "lucide-react";
import Link from "next/link";

export default async function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch categories once in the layout
  const allCategories = await categoriesAPI.getCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 pt-8">
      {/* Breadcrumbs - dynamic based on current path */}
      <DynamicBreadcrumbs categories={allCategories} />

      <div className="flex items-start justify-between mb-16 max-w-5xl mr-2">
        <h1
          className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground max-w-2xl ${exposureTrial.className}`}
        >
          News and Updates about Lightfast
        </h1>
        <Link
          href="/blog/feed.xml"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </Link>
      </div>

      <div className="flex gap-12">
        {/* Category Navigation - shared across all listing pages */}
        <CategoryNav categories={allCategories} />

        {/* Main Content */}
        <main className="flex-1 min-w-0 max-w-3xl">{children}</main>
      </div>
    </div>
  );
}
