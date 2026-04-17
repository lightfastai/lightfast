import type { Route } from "next";
import { getChangelogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";

export async function ChangelogPreview() {
  const entries = getChangelogPages()
    .sort(
      (a, b) =>
        new Date(b.data.publishedAt).getTime() -
        new Date(a.data.publishedAt).getTime(),
    )
    .slice(0, 4);

  if (entries.length === 0) {
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
        {entries.map((page) => {
          const dateStr = new Date(page.data.publishedAt).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
            },
          );

          return (
            <NavLink
              className="group"
              href={`/changelog/${page.slugs[0]}` as Route}
              key={page.slugs[0]}
            >
              <div className="h-full rounded-md border bg-card border-border p-4 transition-colors hover:bg-card/60">
                {/* Version Badge and Date on same line */}
                <div className="mb-4 flex items-center gap-2">
                  {page.data.version && (
                    <span className="inline-flex h-6 items-center rounded-md border border-border px-2 text-muted-foreground text-xs">
                      {page.data.version}
                    </span>
                  )}
                  <time className="text-muted-foreground text-sm">
                    {dateStr}
                  </time>
                </div>

                {/* Title */}
                <h3 className="line-clamp-2 font-medium text-base text-foreground">
                  {page.data.title}
                </h3>
              </div>
            </NavLink>
          );
        })}
      </div>
    </>
  );
}
