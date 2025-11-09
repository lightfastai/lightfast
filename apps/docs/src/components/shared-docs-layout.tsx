import type { ReactNode } from "react";
import { DocsSidebarLayout } from "@/src/components/docs-sidebar-layout";
import type { PageTree } from "fumadocs-core/server";
import "fumadocs-ui/style.css";

interface SharedDocsLayoutProps {
  children: ReactNode;
  tree: PageTree.Root;
}

/**
 * SharedDocsLayout - Shared layout wrapper for both docs and API sections
 *
 * This component provides a consistent layout structure for all documentation
 * pages, whether they are general docs or API reference pages.
 */
export function SharedDocsLayout({ children, tree }: SharedDocsLayoutProps) {
  return <DocsSidebarLayout tree={tree}>{children}</DocsSidebarLayout>;
}