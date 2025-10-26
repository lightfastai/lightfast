"use client";

import {
  AnchorProvider,
  ScrollProvider,
  TOCItem,
  useActiveAnchor,
} from "fumadocs-core/toc";
import type { TOCItemType } from "fumadocs-core/server";
import { useRef, useMemo } from "react";

interface TOCProps {
  items: TOCItemType[];
}

function TOCContent({ items }: TOCProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeAnchor = useActiveAnchor();

  // Find the index of the active item
  const activeIndex = useMemo(() => {
    if (!activeAnchor) return 0;
    const index = items.findIndex((item) =>
      item.url.endsWith(`#${activeAnchor}`),
    );
    return Math.max(0, index);
  }, [activeAnchor, items]);

  return (
    <ScrollProvider containerRef={containerRef}>
      <div ref={containerRef} className="relative space-y-0">
        {/* Background strip behind all items */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted/20" />

        {/* Single sliding highlight */}
        <div
          className="absolute left-0 w-1 bg-white/80 backdrop-blur-sm transition-all duration-300 ease-out"
          style={{
            top: `${activeIndex * 28}px`,
            height: "28px",
          }}
        />

        {items.map((item, _index) => (
          <TOCItem
            key={item.url}
            href={item.url}
            className="relative block text-xs text-muted-foreground hover:text-foreground transition-colors leading-relaxed py-1 pl-6 pr-4 data-[active=true]:text-foreground z-10 h-7 flex items-center"
            style={{
              paddingLeft: `${24 + Math.max(0, item.depth - 2) * 12}px`,
            }}
          >
            {item.title}
          </TOCItem>
        ))}
      </div>
    </ScrollProvider>
  );
}

export function TOC({ items }: TOCProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <h4 className="text-xs font-semibold text-foreground mb-4 pl-6">
        On this page
      </h4>
      <AnchorProvider toc={items}>
        <TOCContent items={items} />
      </AnchorProvider>
    </div>
  );
}

