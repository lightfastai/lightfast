import Link from "next/link";
import { getChangelogPages } from "~/app/(app)/(content)/_lib/source";

export async function HeroChangelogBadge() {
  const pages = getChangelogPages().sort(
    (a, b) =>
      new Date(b.data.publishedAt).getTime() -
      new Date(a.data.publishedAt).getTime(),
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
    },
  );

  return (
    <Link
      className="inline-flex h-7 items-center gap-2 rounded-sm border border-border/50 bg-card/80 px-2.5 text-muted-foreground text-sm backdrop-blur-md transition-colors hover:text-foreground"
      href={`/changelog/${latest.slugs[0]}`}
      prefetch
    >
      <span className="text-foreground">{dateStr}</span>
      <span className="line-clamp-1">{latest.data.title}</span>
      <span>→</span>
    </Link>
  );
}
