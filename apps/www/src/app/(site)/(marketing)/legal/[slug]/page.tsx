import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getLegalPage, getLegalPages } from "~/lib/content/source";
import { emitLegalSeo } from "~/lib/seo-bundle";
import type { LegalUrl } from "~/lib/url-types";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getLegalPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  if (!page) {
    return {};
  }

  const url = `https://lightfast.ai/legal/${slug}` as LegalUrl;
  return emitLegalSeo(page.data, url).metadata;
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/legal/${slug}` as LegalUrl;
  const { jsonLd } = emitLegalSeo(page.data, url);
  const MDXContent = page.data.body;

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={jsonLd} />
      <article className="mx-auto w-full max-w-3xl px-6 pt-36 pb-24 sm:px-10 md:pt-40 md:pb-32">
        <MDXContent components={markdownComponents} />
      </article>
    </main>
  );
}
