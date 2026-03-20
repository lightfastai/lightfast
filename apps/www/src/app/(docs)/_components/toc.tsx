"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import {
  AnchorProvider,
  ScrollProvider,
  TOCItem,
  useActiveAnchor,
} from "fumadocs-core/toc";
import { useMemo, useRef } from "react";

interface TOCProps {
  items: TOCItemType[];
}

function TOCContent({ items }: TOCProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeAnchor = useActiveAnchor();

  // Build anchor→index Map once when items change (O(1) lookup vs O(n) findIndex)
  const anchorIndexMap = useMemo(
    () => new Map(items.map((item, i) => [item.url.split("#")[1] ?? "", i])),
    [items]
  );

  const activeIndex = useMemo(() => {
    if (!activeAnchor) {
      return 0;
    }
    return Math.max(0, anchorIndexMap.get(activeAnchor) ?? 0);
  }, [activeAnchor, anchorIndexMap]);

  return (
    <ScrollProvider containerRef={containerRef}>
      <div className="relative space-y-0" ref={containerRef}>
        {/* Background strip behind all items */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-muted/20" />

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
            className="relative z-10 block flex h-7 items-center truncate py-1 pr-4 pl-6 text-muted-foreground text-sm leading-relaxed transition-colors hover:text-foreground data-[active=true]:text-foreground"
            href={item.url}
            key={item.url}
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
      <h4 className="mb-4 pl-6 font-semibold text-foreground text-xs">
        On this page
      </h4>
      <AnchorProvider toc={items}>
        <TOCContent items={items} />
      </AnchorProvider>
    </div>
  );
}
