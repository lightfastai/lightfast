import { Icons } from "@repo/ui/components/icons";
import type { Route } from "next";
import Image from "next/image";
import {
  getBlogPages,
  getChangelogPages,
} from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";

type FeedItem =
  | { kind: "blog"; page: ReturnType<typeof getBlogPages>[number] }
  | { kind: "changelog"; page: ReturnType<typeof getChangelogPages>[number] };

const TYPE_LABEL: Record<FeedItem["kind"], string> = {
  blog: "Blog",
  changelog: "Changelog",
};

function hrefFor(item: FeedItem): Route {
  return `/${item.kind}/${item.page.slugs[0]}` as Route;
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
  sizes,
  src,
}: {
  alt: string;
  iconSize: string;
  sizes: string;
  src: string | undefined;
}) {
  if (src) {
    return (
      <Image
        alt={alt}
        className="h-full w-full object-cover"
        fill
        quality={100}
        sizes={sizes}
        src={src}
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
      {TYPE_LABEL[kind]}
    </span>
  );
}

function FeaturedCard({ item }: { item: FeedItem }) {
  return (
    <NavLink className="group lg:col-span-4" href={hrefFor(item)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border/50 bg-card">
        <ImageOrFallback
          alt={item.page.data.title}
          iconSize="h-10 w-10"
          sizes="(min-width: 1024px) 80vw, 100vw"
          src={item.page.data.featuredImage}
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <TypeBadge kind={item.kind} />
        <time className="text-muted-foreground text-sm">
          {formatDate(item.page.data.publishedAt)}
        </time>
      </div>
      <h3 className="mt-2 line-clamp-2 font-medium font-pp text-2xl text-foreground tracking-tight group-hover:underline">
        {item.page.data.title}
      </h3>
    </NavLink>
  );
}

function SquareCard({ item }: { item: FeedItem }) {
  return (
    <NavLink className="group block" href={hrefFor(item)}>
      <div className="relative hidden aspect-square w-full overflow-hidden rounded-md border border-border/50 bg-card lg:block">
        <ImageOrFallback
          alt={item.page.data.title}
          iconSize="h-6 w-6"
          sizes="20vw"
          src={item.page.data.featuredImage}
        />
      </div>
      <div className="flex min-w-0 flex-col lg:mt-3">
        <div className="flex items-center gap-2">
          <TypeBadge kind={item.kind} />
          <time className="text-muted-foreground text-sm">
            {formatDate(item.page.data.publishedAt)}
          </time>
        </div>
        <h3 className="mt-1 line-clamp-2 font-medium text-base text-foreground group-hover:underline">
          {item.page.data.title}
        </h3>
      </div>
    </NavLink>
  );
}

export function LatestContentPreview() {
  const blogs: FeedItem[] = getBlogPages().map((page) => ({
    kind: "blog",
    page,
  }));
  const changelogs: FeedItem[] = getChangelogPages().map((page) => ({
    kind: "changelog",
    page,
  }));

  const merged = [...blogs, ...changelogs]
    .sort(
      (a, b) =>
        new Date(b.page.data.publishedAt).getTime() -
        new Date(a.page.data.publishedAt).getTime()
    )
    .slice(0, 4);

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
