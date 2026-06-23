import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getLegalPublication, getLegalStaticParams } from "~/lib/publishing";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getLegalStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return getLegalPublication(slug)?.metadata ?? {};
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  const publication = getLegalPublication(slug);
  if (!publication) {
    notFound();
  }

  const MDXContent = publication.body;

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={publication.jsonLd} />
      <article className="pt-28 pb-24 sm:pt-32 md:pb-32 lg:pt-24">
        <MDXContent components={markdownComponents} />
      </article>
    </main>
  );
}
