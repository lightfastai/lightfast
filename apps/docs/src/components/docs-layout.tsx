import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { TOC } from "./toc";

interface DocsLayoutProps {
  children: ReactNode;
  toc: TOCItemType[];
}

export function DocsLayout({ children, toc }: DocsLayoutProps) {
  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl">{children}</div>
      </div>
      {/* TOC Sidebar - Desktop only */}
      <div className="w-64 pl-8 max-lg:hidden lg:block">
        <div className="sticky top-8">
          <TOC items={toc} />
        </div>
      </div>
    </div>
  );
}
