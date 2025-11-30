import type { ReactNode } from "react";
import { DocsSidebarWrapper } from "@/src/components/docs-sidebar-wrapper";
import { pageTree, apiPageTree } from "@/src/lib/source";
import "fumadocs-ui/style.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsSidebarWrapper pageTree={pageTree} apiPageTree={apiPageTree}>
      {children}
    </DocsSidebarWrapper>
  );
}