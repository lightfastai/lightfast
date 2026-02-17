import Link from "next/link";
import { changelog  } from "@vendor/cms";
import type {ChangelogEntriesQueryResponse} from "@vendor/cms";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import { ArrowRight } from "lucide-react";

export function AnnouncementBadge() {
  return (
    <Feed draft={isDraft} queries={[changelog.entriesQuery]}>
      {([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog?.post?.items ?? [];
        const latest = entries[0];

        if (!latest) {
          return null;
        }

        return (
          <Link
            href={`/changelog/${latest.slug}`}
            target="_blank"
            className="mb-8 inline-flex items-center gap-3 rounded-full bg-secondary/50 border border-border/30 py-1.5 pl-1.5 pr-4 text-xs transition-colors hover:bg-secondary/80"
          >
            <span className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background">
              NEW
            </span>
            <span className="text-muted-foreground line-clamp-1">
              {latest._title}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          </Link>
        );
      }}
    </Feed>
  );
}
