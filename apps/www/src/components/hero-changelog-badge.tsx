import Link from "next/link";
import { changelog, type ChangelogEntriesQueryResponse } from "@vendor/cms";
import { Feed } from "@vendor/cms/components/feed";

export function HeroChangelogBadge() {
  return (
    <Feed queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog?.post?.items ?? [];
        const latest = entries[0];

        if (!latest) {
          return null;
        }

        // Format date
        const publishedTime = latest.publishedAt ?? latest._sys?.createdAt;
        const dateStr = publishedTime
          ? new Date(publishedTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "";

        return (
          <Link
            href={`/changelog/${latest.slug}`}
            className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md bg-[var(--nav-pill)] backdrop-blur-md text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-foreground">{dateStr}</span>
            <span className="line-clamp-1">{latest._title}</span>
            <span>→</span>
          </Link>
        );
      }}
    </Feed>
  );
}
