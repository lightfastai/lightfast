import type { ReactNode } from "react";
import { mdxComponents } from "@/mdx-components";
import { DocsLayout } from "@/src/components/docs-layout";
import type { TOCItemType } from "fumadocs-core/server";
import type { MDXComponents } from "mdx/types";

interface SharedPageProps {
  MDX: React.ComponentType<{ components?: MDXComponents }>;
  toc: TOCItemType[];
  children?: ReactNode;
}

/**
 * SharedPage - Shared page component for rendering MDX content
 *
 * This component provides a consistent structure for rendering
 * documentation content with table of contents support.
 * Used by both docs and API pages.
 */
export function SharedPage({ MDX, toc, children }: SharedPageProps) {
  return (
    <DocsLayout toc={toc}>
      <article className="max-w-none">
        <MDX components={mdxComponents} />
        {children}
      </article>
    </DocsLayout>
  );
}