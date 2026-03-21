import type { ChangelogEntriesQueryResponse } from "@vendor/cms";
import { changelog } from "@vendor/cms";
import { Feed } from "@vendor/cms/components/feed";
import Link from "next/link";

export function HeroChangelogBadge() {
  return (
    <Feed queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog.post.items;
        const latest = entries[0];

        if (!latest) {
          return null;
        }

        const publishedTime = latest.publishedAt;
        const dateStr = publishedTime
          ? new Date(publishedTime).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "";

        return (
          <Link
            className="inline-flex h-7 items-center gap-2 rounded-sm border border-border/50 bg-card/80 px-2.5 text-muted-foreground text-sm backdrop-blur-md transition-colors hover:text-foreground"
            href={`/changelog/${latest.slug}`}
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
