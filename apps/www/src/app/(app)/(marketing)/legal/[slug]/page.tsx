import { JsonLd } from "@vendor/seo/json-ld";
import { notFound } from "next/navigation";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import { getLegalPage, getLegalPages } from "~/app/(app)/(content)/_lib/source";
import { emitLegalSeo } from "~/lib/seo-bundle";
import type { LegalUrl } from "~/lib/url-types";

export const dynamic = "force-static";

interface LegalPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getLegalPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: LegalPageProps) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  if (!page) {
    return {};
  }
  const url = `https://lightfast.ai/legal/${slug}` as LegalUrl;
  const { metadata } = emitLegalSeo(page.data, url);
  return metadata;
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/legal/${slug}` as LegalUrl;
  const { jsonLd } = emitLegalSeo(page.data, url);
  const MDXContent = page.data.body;

  return (
    <>
      <JsonLd code={jsonLd} />
      <div className="grid grid-cols-1 items-start gap-8 py-8 sm:py-12 md:grid-cols-12 lg:py-32">
        <div className="md:col-span-2">
          {page.data.updatedAt && (
            <div className="text-muted-foreground text-sm">
              <p className="mb-1 font-medium">Last updated</p>
              <time className="whitespace-nowrap">
                {new Date(page.data.updatedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          )}
        </div>
        <article className="space-y-8 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4">
          <div className="max-w-none">
            <MDXContent components={mdxComponents} />
          </div>
        </article>
      </div>
    </>
  );
}
