"use client";

import { usePathname } from "next/navigation";
import { DocsSidebarLayout } from "./docs-sidebar-layout";
import type { ReactNode } from "react";
import type { PageTree } from "fumadocs-core/server";

interface DocsSidebarWrapperProps {
  children: ReactNode;
  pageTree: PageTree.Root;
  apiPageTree: PageTree.Root;
}

export function DocsSidebarWrapper({
  children,
  pageTree,
  apiPageTree
}: DocsSidebarWrapperProps) {
  const pathname = usePathname();

  // Determine which tree to use based on the current path
  const isApiDocs = pathname.includes("/api-reference");
  const tree = isApiDocs ? apiPageTree : pageTree;

  return <DocsSidebarLayout tree={tree}>{children}</DocsSidebarLayout>;
}