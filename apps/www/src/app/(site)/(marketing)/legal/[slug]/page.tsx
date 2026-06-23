import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getLegalPage, getLegalPages } from "~/lib/content/source";
import { emitLegalSeo } from "~/lib/seo-bundle";

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

  const url = `https://lightfast.ai/legal/${slug}`;
  return emitLegalSeo(page.data, url).metadata;
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const page = getLegalPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/legal/${slug}`;
  const { jsonLd } = emitLegalSeo(page.data, url);
  const MDXContent = page.data.body;

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={jsonLd} />
      <article className="pt-28 pb-24 sm:pt-32 md:pb-32 lg:pt-24">
        <MDXContent components={markdownComponents} />
      </article>
    </main>
  );
}
