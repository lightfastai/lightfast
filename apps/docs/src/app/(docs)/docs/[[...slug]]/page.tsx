import { getPage, getPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeveloperPlatformLanding } from "./_components/developer-platform-landing";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { generatePageMetadata } from "@/src/lib/metadata-utils";
import { exposureTrial } from "@/src/lib/fonts";

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
  const title = page.data.title;
  const description = page.data.description;

  return (
    <DocsLayout toc={toc}>
      <article className="max-w-none">
        {/* Page Header */}
        {(title || description) && (
          <div className="flex w-full flex-col items-center text-center mb-16 max-w-3xl mx-auto">
            {title && (
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] text-balance ${exposureTrial.className}`}
              >
                {title}
              </h1>
            )}
            {description && (
              <div className="mt-4 w-full">
                <p className="text-base text-muted-foreground">{description}</p>
              </div>
            )}
          </div>
        )}

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
