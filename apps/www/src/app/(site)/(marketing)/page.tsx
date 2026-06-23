import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getHomePublication } from "~/lib/publishing";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return getHomePublication()?.metadata ?? {};
}

export default function HomePage() {
  const publication = getHomePublication();
  if (!publication) {
    notFound();
  }

  const MDXContent = publication.body;

  return (
    <main className="bg-background text-foreground">
      <JsonLd code={publication.jsonLd} />

      <section className="flex flex-col items-center pt-28 pb-16 text-center sm:pt-32 lg:pt-24">
        <h1 className="font-medium font-title text-3xl text-foreground tracking-normal lg:text-4xl">
          {publication.title}
        </h1>
      </section>

      <article className="pb-24 md:pb-32">
        <MDXContent components={markdownComponents} />
      </article>
    </main>
  );
}
