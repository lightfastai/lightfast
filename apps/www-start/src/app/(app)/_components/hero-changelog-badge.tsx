import { NavLink } from "~/components/nav-link";
import { landingContent } from "~/lib/landing-content";

export function HeroChangelogBadge() {
  const latest = landingContent.hero.badge;

  return (
    <NavLink
      className="inline-flex h-7 items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 text-muted-foreground text-sm backdrop-blur-md transition-colors hover:text-foreground"
      href={latest.href}
      prefetch
    >
      <span className="shrink-0 text-foreground">{latest.date}</span>
      <span className="line-clamp-1">{latest.title}</span>
      <span>-&gt;</span>
    </NavLink>
  );
}
