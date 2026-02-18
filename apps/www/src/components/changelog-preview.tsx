import Link from "next/link";
import { changelog  } from "@vendor/cms";
import type {ChangelogEntriesQueryResponse} from "@vendor/cms";
import { Feed, isDraft } from "@vendor/cms/components/feed";

export function ChangelogPreview() {
  return (
    <Feed draft={isDraft} queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog?.post?.items ?? [];

        // Get the latest 4 entries
        const latestEntries = entries.slice(0, 4);

        if (latestEntries.length === 0) {
          return null;
        }

        return (
          <>
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-pp font-medium tracking-tight text-foreground mb-2">
                Changelog
              </h2>
              <p className="text-foreground/60">
                Stay up to date with the latest improvements and updates
              </p>
            </div>

            {/* Changelog Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {latestEntries.map((item) => {
                // Use publishedAt if available, fall back to createdAt
                const publishedTime = item.publishedAt ?? item._sys?.createdAt;
                const dateStr = publishedTime
                  ? new Date(publishedTime).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "";

                return (
                  <Link
                    key={item._slug ?? item._title}
                    href={`/changelog/${item.slug}`}
                    className="group"
                  >
                    <div className="h-full rounded-md border border-border p-4 transition-colors hover:bg-card/60">
                      {/* Version Badge and Date on same line */}
                      <div className="flex items-center gap-2 mb-4">
                        {item.slug && (
                          <span className="inline-flex items-center h-6 px-2 rounded-md border border-border text-xs text-muted-foreground">
                            {item.slug.slice(0, 3)}
                          </span>
                        )}
                        <time className="text-sm text-muted-foreground">
                          {dateStr}
                        </time>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-medium text-foreground line-clamp-2">
                        {item._title}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        );
      }}
    </Feed>
  );
}
