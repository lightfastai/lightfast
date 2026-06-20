"use client";

import { cn } from "@repo/ui-v2/lib/utils";
import { useEffect, useMemo, useState } from "react";

export interface TocItem {
  title: string;
  depth: 2 | 3;
  id: string;
}

interface TocProps {
  items: readonly TocItem[];
}

export function Toc({ items }: TocProps) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const [activeId, setActiveId] = useState(itemIds[0] ?? "");

  useEffect(() => {
    const headings = itemIds
      .map((id) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => heading !== null);

    const firstHeading = headings[0];
    if (!firstHeading) {
      return;
    }

    const updateActiveHeading = () => {
      const offset = 136;
      const currentHeading =
        headings
          .filter((heading) => heading.getBoundingClientRect().top <= offset)
          .at(-1) ?? firstHeading;

      setActiveId(currentHeading.id);
    };

    updateActiveHeading();
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);

    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [itemIds]);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-28 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4"
    >
      <p className="mb-3 font-medium text-sm">On this page</p>
      <ol>
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <li key={item.id}>
              <a
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "relative block py-2 pr-3 text-muted-foreground text-sm leading-6 transition-colors hover:text-foreground",
                  item.depth === 3 ? "pl-8" : "pl-6",
                  isActive && "text-foreground"
                )}
                href={`#${item.id}`}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-[1.1em] left-0 size-2 rounded-full bg-primary"
                  />
                )}
                <span className="relative">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
