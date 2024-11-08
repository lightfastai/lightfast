import type { Doc } from "contentlayer/generated";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";

import type { NavItem, NavItemWithChildren } from "~/types/nav";
import { siteNav } from "~/config/site";

interface DocsPagerProps {
  doc: Doc;
}

export function DocsPager({ doc }: DocsPagerProps) {
  const pager = getPagerForDoc(doc);

  return (
    <div className="flex flex-row items-center justify-between">
      {pager.prev?.href && (
        <Button variant="ghost" asChild>
          <Link href={pager.prev.href}>
            <ChevronLeft />
            {pager.prev.title}
          </Link>
        </Button>
      )}
      {pager.next?.href && (
        <Button variant="ghost" className="ml-auto" asChild>
          <Link href={pager.next.href}>
            {pager.next.title}
            <ChevronRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function getPagerForDoc(doc: Doc) {
  const nav = siteNav.docsNav;
  const flattenedLinks = [null, ...flatten(nav), null];
  const activeIndex = flattenedLinks.findIndex(
    (link) => doc.slug === link?.href,
  );
  const prev = activeIndex !== 0 ? flattenedLinks[activeIndex - 1] : null;
  const next =
    activeIndex !== flattenedLinks.length - 1
      ? flattenedLinks[activeIndex + 1]
      : null;
  return {
    prev,
    next,
  };
}

export function flatten(links: NavItemWithChildren[]): NavItem[] {
  return links
    .reduce<NavItem[]>((flat, link) => {
      return flat.concat(link.items.length ? flatten(link.items) : link);
    }, [])
    .filter((link) => !link.disabled);
}
