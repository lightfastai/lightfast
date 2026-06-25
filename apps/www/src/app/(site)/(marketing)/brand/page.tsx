import { Button } from "@repo/ui-v2/components/ui/button";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getBrandPublication } from "~/lib/publishing";
import {
  MarketingContentBleed,
  marketingLayout,
} from "../_components/layout-primitives";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return getBrandPublication()?.metadata ?? {};
}

export default function BrandPage() {
  const publication = getBrandPublication();
  if (!publication) {
    notFound();
  }

  const MDXContent = publication.body;

  return (
    <>
      <JsonLd code={publication.jsonLd} />
      <article className="w-full bg-background text-foreground">
        <section
          className={`flex flex-col items-center pb-16 text-center ${marketingLayout.pageTop}`}
        >
          <h1 className="font-medium font-title text-3xl text-foreground tracking-normal lg:text-4xl">
            {publication.title}
          </h1>
          <Button
            className="mt-10"
            nativeButton={false}
            render={<a href="#contact">Contact</a>}
            size="lg"
            variant="secondary"
          />
        </section>

        <section>
          <MarketingContentBleed className="aspect-video overflow-hidden rounded-xs bg-foreground">
            <Image
              alt="Lightfast wordmark"
              className="object-cover"
              fill
              quality={40}
              sizes="(max-width: 640px) calc(100vw - 3rem), (max-width: 1024px) calc(100vw - 5rem), 48rem"
              src="/images/marketing/wordmark-panel.webp"
            />
          </MarketingContentBleed>
        </section>

        <div className="py-16 md:py-24">
          <MDXContent components={markdownComponents} />
        </div>
      </article>
    </>
  );
}
