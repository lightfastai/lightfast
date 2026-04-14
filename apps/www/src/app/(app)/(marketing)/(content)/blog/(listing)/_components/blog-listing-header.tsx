import { RssIcon } from "lucide-react";
import type { Route } from "next";
import { NavLink } from "~/components/nav-link";

interface BlogListingHeaderProps {
  tagline?: string;
  title: string;
}

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
    </div>
  );
}
