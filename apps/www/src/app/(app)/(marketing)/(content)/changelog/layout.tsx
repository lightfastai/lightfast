import { RssIcon } from "lucide-react";
import type { Route } from "next";
import { NavLink } from "~/components/nav-link";

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl pt-24 pb-32">
      <div className="mb-12 flex items-center justify-between">
        <h1 className="font-medium font-pp text-3xl text-foreground">
          Changelog
        </h1>
        <NavLink
          className="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href={"/changelog/rss.xml" as Route}
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </NavLink>
      </div>
      {children}
    </div>
  );
}
