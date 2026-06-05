import { createFileRoute, notFound } from "@tanstack/react-router";
import BlogPostPage from "~/app/(app)/(marketing)/(content)/blog/[slug]/page";
import BlogLayout from "~/app/(app)/(marketing)/(content)/blog/layout";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildBlogPostHead, getBlogPage } from "~/lib/blog-content";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const page = getBlogPage(params.slug);

    if (!page) {
      throw notFound();
    }

    return page;
  },
  head: ({ params }) => {
    const page = getBlogPage(params.slug);

    return page ? buildBlogPostHead(page) : {};
  },
  component: BlogPostRoute,
});

function BlogPostRoute() {
  const page = Route.useLoaderData();

  return (
    <MarketingLayout>
      <BlogLayout>
        <BlogPostPage page={page} />
      </BlogLayout>
    </MarketingLayout>
  );
}
