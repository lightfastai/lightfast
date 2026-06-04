import { CategoryNav } from "~/app/(app)/_components/blog-category-nav";
import { getBlogCategories } from "~/lib/blog-content";

const BLOG_CATEGORIES = getBlogCategories();

export default function BlogListingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl pt-24 pb-32">
      <div className="relative">
        {/* Desktop: Category nav aligned with first post (offset matches BlogListingHeader: text-3xl line-height + mb-12) */}
        <div className="absolute top-[5.25rem] right-full mr-12 hidden xl:block">
          <CategoryNav categories={BLOG_CATEGORIES} />
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}
