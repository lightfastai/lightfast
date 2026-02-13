import { RssIcon } from "lucide-react";
import Link from "next/link";

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-32">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-3xl font-pp text-foreground font-medium">
          Changelog
        </h1>
        <Link
          href="/changelog/rss.xml"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Subscribe to RSS Feed"
        >
          <RssIcon className="h-4 w-4" />
          <span>RSS Feed</span>
        </Link>
      </div>
      {children}
    </div>
  );
}
