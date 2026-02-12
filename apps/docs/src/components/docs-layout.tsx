import type { ReactNode } from "react";
import type { TOCItemType } from "fumadocs-core/server";
import { TOC } from "./toc";

interface DocsLayoutProps {
  children: ReactNode;
  toc: TOCItemType[];
}

export function DocsLayout({ children, toc }: DocsLayoutProps) {
  return (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <div className="max-w-4xl mx-auto">{children}</div>
      </div>
      {/* TOC Sidebar - Desktop only */}
      <div className="max-lg:hidden lg:block w-64 pl-8">
        <div className="sticky top-8">
          <TOC items={toc} />
        </div>
      </div>
    </div>
  );
}
