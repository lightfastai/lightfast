import { getPage, getPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeveloperPlatformLanding } from "./_components/developer-platform-landing";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { generatePageMetadata } from "@/src/lib/metadata-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /docs to /docs/get-started/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/get-started/overview");
  }

  const page = getPage(resolvedParams.slug);

  if (!page) {
    return notFound();
  }

  // Show custom landing page for the get-started/overview page
  if (
    resolvedParams.slug.length === 2 &&
    resolvedParams.slug[0] === "get-started" &&
    resolvedParams.slug[1] === "overview"
  ) {
    return <DeveloperPlatformLanding />;
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
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const page = getPage(resolvedParams.slug);
  return generatePageMetadata(page?.data ?? null);
}
