import { Icons } from "@repo/ui/components/icons";
import { NavLink } from "~/components/nav-link";
import { resolveContentAssetSrc } from "~/lib/content-assets";
import { landingContent } from "~/lib/landing-content";

type FeedItem = (typeof landingContent.featured)[number];

function hrefFor(item: FeedItem): string {
  return item.href;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ImageOrFallback({
  alt,
  iconSize,
  src,
}: {
  alt: string;
  iconSize: string;
  src: string | undefined;
}) {
  if (src) {
    return (
      <img
        alt={alt}
        className="h-full w-full object-cover"
        height={675}
        loading="lazy"
        src={resolveContentAssetSrc(src)}
        width={1200}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-card">
      <Icons.logoShort className={`${iconSize} text-muted-foreground`} />
    </div>
  );
}

function TypeBadge({ kind }: { kind: FeedItem["kind"] }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-border/50 px-2 text-muted-foreground text-xs">
      {kind}
    </span>
  );
}

function FeaturedCard({ item }: { item: FeedItem }) {
  return (
    <NavLink className="group lg:col-span-4" href={hrefFor(item)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/50 bg-card">
        <ImageOrFallback
          alt={item.title}
          iconSize="h-10 w-10"
          src={item.image}
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <TypeBadge kind={item.kind} />
        <time className="text-muted-foreground text-sm">
          {formatDate(item.publishedAt)}
        </time>
      </div>
      <h3 className="mt-2 line-clamp-2 font-medium font-pp text-2xl text-foreground tracking-tight group-hover:underline">
        {item.title}
      </h3>
    </NavLink>
  );
}

function SquareCard({ item }: { item: FeedItem }) {
  return (
    <NavLink className="group block" href={hrefFor(item)}>
      <div className="relative hidden aspect-square w-full overflow-hidden rounded-md border border-border/50 bg-card lg:block">
        <ImageOrFallback alt={item.title} iconSize="h-6 w-6" src={item.image} />
      </div>
      <div className="flex min-w-0 flex-col lg:mt-3">
        <div className="flex items-center gap-2">
          <TypeBadge kind={item.kind} />
          <time className="text-muted-foreground text-sm">
            {formatDate(item.publishedAt)}
          </time>
        </div>
        <h3 className="mt-1 line-clamp-2 font-medium text-base text-foreground group-hover:underline">
          {item.title}
        </h3>
      </div>
    </NavLink>
  );
}

export function LatestContentPreview() {
  const merged = [...landingContent.featured].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  if (merged.length === 0) {
    return null;
  }

  const [featured, ...rest] = merged;
  if (!featured) {
    return null;
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-medium font-pp text-3xl text-foreground tracking-tight">
          Featured
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <FeaturedCard item={featured} />
        <div className="flex flex-col gap-4">
          {rest.map((item) => (
            <SquareCard item={item} key={hrefFor(item)} />
          ))}
        </div>
      </div>
    </>
  );
}
