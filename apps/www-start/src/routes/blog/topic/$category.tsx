import { createFileRoute, notFound } from "@tanstack/react-router";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import BlogLayout from "~/app/(app)/(marketing)/(content)/blog/layout";
import BlogListingLayout from "~/app/(app)/(marketing)/(content)/blog/(listing)/layout";
import BlogCategoryPage from "~/app/(app)/(marketing)/(content)/blog/(listing)/topic/[category]/page";
import {
  buildBlogCategoryHead,
  isBlogCategory,
} from "~/lib/blog-content";

export const Route = createFileRoute("/blog/topic/$category")({
  loader: ({ params }) => {
    if (!isBlogCategory(params.category)) {
      throw notFound();
    }

    return params.category;
  },
  head: ({ params }) => {
    if (!isBlogCategory(params.category)) {
      return {};
    }

    return buildBlogCategoryHead(params.category);
  },
  component: BlogCategoryRoute,
});

function BlogCategoryRoute() {
  const category = Route.useLoaderData();

  return (
    <MarketingLayout>
      <BlogLayout>
        <BlogListingLayout>
          <BlogCategoryPage category={category} />
        </BlogListingLayout>
      </BlogLayout>
    </MarketingLayout>
  );
}
