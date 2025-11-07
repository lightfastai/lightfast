import type { ReactNode } from "react";
import { SharedDocsLayout } from "@/src/components/shared-docs-layout";
import { pageTree } from "@/src/lib/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <SharedDocsLayout tree={pageTree}>{children}</SharedDocsLayout>;
}
