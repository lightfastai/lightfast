import type { ChangelogEntriesQueryResponse } from "@vendor/cms";
import { changelog } from "@vendor/cms";
import { Feed, isDraft } from "@vendor/cms/components/feed";
import Link from "next/link";

export function ChangelogPreview() {
  return (
    <Feed draft={isDraft} queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelog.post.items;

        // Get the latest 4 entries
        const latestEntries = entries.slice(0, 4);

        if (latestEntries.length === 0) {
          return null;
        }

        return (
          <>
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="mb-2 font-medium font-pp text-3xl text-foreground tracking-tight">
                Changelog
              </h2>
              <p className="text-foreground/60">
                Stay up to date with the latest improvements and updates
              </p>
            </div>

            {/* Changelog Cards Grid */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {latestEntries.map((item) => {
                const publishedTime = item.publishedAt;
                const dateStr = publishedTime
                  ? new Date(publishedTime).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "";

                return (
                  <Link
                    className="group"
                    href={`/changelog/${item.slug}`}
                    key={item._slug}
                  >
                    <div className="h-full rounded-md border border-border p-4 transition-colors hover:bg-card/60">
                      {/* Version Badge and Date on same line */}
                      <div className="mb-4 flex items-center gap-2">
                        {item.prefix && (
                          <span className="inline-flex h-6 items-center rounded-md border border-border px-2 text-muted-foreground text-xs">
                            {item.prefix}
                          </span>
                        )}
                        <time className="text-muted-foreground text-sm">
                          {dateStr}
                        </time>
                      </div>

                      {/* Title */}
                      <h3 className="line-clamp-2 font-medium text-base text-foreground">
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
