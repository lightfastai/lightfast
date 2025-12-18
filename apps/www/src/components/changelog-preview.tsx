import Link from "next/link";
import { changelog, type ChangelogEntriesQueryResponse } from "@vendor/cms";
import { Feed } from "@vendor/cms/components/feed";
import { ArrowRight } from "lucide-react";

export const revalidate = 300;

export function ChangelogPreview() {
  return (
    <Feed queries={[changelog.entriesQuery]}>
      {async ([data]) => {
        "use server";

        const response = data as ChangelogEntriesQueryResponse;
        const entries = response.changelogPages?.items ?? [];

        // Get the latest 4 entries
        const latestEntries = entries.slice(0, 4);

        if (latestEntries.length === 0) {
          return null;
        }

        return (
          <>
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-light tracking-tight text-foreground mb-2">
                Changelog
              </h2>
              <p className="text-muted-foreground">
                Stay up to date with the latest improvements and updates
              </p>
            </div>

            {/* Changelog Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {latestEntries.map((item) => {
                // Use publishedAt if available, fall back to createdAt
                const publishedTime = item.publishedAt ?? item._sys?.createdAt;
                const created = publishedTime ? new Date(publishedTime) : null;
                const dateStr = created
                  ? created.toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "";

                // Count items in each section for display
                const improvementsCount = item.improvements
                  ? item.improvements
                      .split("\n")
                      .filter((line) => line.trim().startsWith("-")).length
                  : 0;
                const fixesCount = item.fixes
                  ? item.fixes
                      .split("\n")
                      .filter((line) => line.trim().startsWith("-")).length
                  : 0;
                const totalChanges = improvementsCount + fixesCount;

                return (
                  <Link
                    key={item._slug ?? item._title}
                    href={`/changelog/${item.slug}`}
                    className="group"
                  >
                    <div className="h-full rounded-xs border border-transparent bg-card p-4 transition-all duration-200 hover:border-muted-foreground/20 hover:bg-accent/5">
                      {/* Version Badge and Date on same line */}
                      <div className="flex items-center gap-2 mb-4">
                        {item.slug && (
                          <span className="inline-block border rounded-full px-3 py-1 text-xs text-muted-foreground">
                            {item.slug.slice(0, 3)}
                          </span>
                        )}
                        <time className="text-xs text-muted-foreground">
                          {dateStr}
                        </time>
                      </div>

                      {/* Title */}
                      <h3 className="text-md font-medium text-foreground line-clamp-2 px-2">
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
