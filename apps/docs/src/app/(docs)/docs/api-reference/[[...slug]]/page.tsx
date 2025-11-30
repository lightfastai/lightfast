import { getApiPage, getApiPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { generatePageMetadata } from "@/src/lib/metadata-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /docs/api-reference to /docs/api-reference/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/api-reference/overview");
  }

  const page = getApiPage(resolvedParams.slug);

  if (!page) {
    return notFound();
  }

  const MDX = page.data.body;
  const toc = page.data.toc;

  return (
    <DocsLayout toc={toc}>
      <article className="max-w-none">
        <MDX components={mdxComponents} />
      </article>
    </DocsLayout>
  );
}

export function generateStaticParams() {
  return getApiPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const page = getApiPage(resolvedParams.slug);
  return generatePageMetadata(page?.data ?? null);
}