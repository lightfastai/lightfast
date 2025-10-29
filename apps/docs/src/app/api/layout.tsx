import type { ReactNode } from "react";
import { SharedDocsLayout } from "@/src/components/shared-docs-layout";
import { apiPageTree } from "@/src/lib/source";

export default function ApiLayout({ children }: { children: ReactNode }) {
  return <SharedDocsLayout tree={apiPageTree}>{children}</SharedDocsLayout>;
}