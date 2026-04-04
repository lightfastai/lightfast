import type { TOCItemType } from "fumadocs-core/toc";
import type { ReactNode } from "react";
import { TOC } from "~/app/(app)/(content)/docs/_components/toc";

interface DocsLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
  toc: TOCItemType[];
}

export function DocsLayout({ children, toc, fullWidth }: DocsLayoutProps) {
  return (
    <div className="flex">
      <div className="min-w-0 flex-1">
        <div className={fullWidth ? "" : "mx-auto max-w-4xl"}>{children}</div>
      </div>
      {!fullWidth && (
        <div className="w-64 pl-8 max-lg:hidden lg:block">
          <div className="sticky top-8">
            <TOC items={toc} />
          </div>
        </div>
      )}
    </div>
  );
}
