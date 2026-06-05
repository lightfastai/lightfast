import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import BlogListingLayout from "~/app/(app)/(marketing)/(content)/blog/(listing)/layout";
import BlogPage from "~/app/(app)/(marketing)/(content)/blog/(listing)/page";
import BlogLayout from "~/app/(app)/(marketing)/(content)/blog/layout";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildBlogIndexHead } from "~/lib/blog-content";

export const Route = createFileRoute("/blog")({
  head: () => buildBlogIndexHead(),
  component: BlogRoute,
});

function BlogRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isIndexRoute = pathname === "/blog" || pathname === "/blog/";

  return (
    <MarketingLayout>
      <BlogLayout>
        {isIndexRoute ? (
          <BlogListingLayout>
            <BlogPage />
          </BlogListingLayout>
        ) : (
          <Outlet />
        )}
      </BlogLayout>
    </MarketingLayout>
  );
}
