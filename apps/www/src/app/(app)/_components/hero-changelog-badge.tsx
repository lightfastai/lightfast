import type { Route } from "next";
import { getChangelogPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";

export async function HeroChangelogBadge() {
  const pages = getChangelogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime()
  );
  const latest = pages[0];

  if (!latest) {
    return null;
  }

  const dateStr = new Date(latest.data.publishedAt).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );

  return (
    <NavLink
      className="inline-flex h-7 items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 text-muted-foreground text-sm backdrop-blur-md transition-colors hover:text-foreground"
      href={`/changelog/${latest.slugs[0]}` as Route}
      prefetch
    >
      <span className="text-foreground">{dateStr}</span>
      <span className="line-clamp-1">{latest.data.title}</span>
      <span>→</span>
    </NavLink>
  );
}
