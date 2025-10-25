import type { ReactNode } from "react";
import { DocsSidebarLayout } from "@/src/components/docs-sidebar-layout";
import { pageTree } from "@/src/lib/source";
import "fumadocs-ui/style.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <DocsSidebarLayout tree={pageTree}>{children}</DocsSidebarLayout>;
}
