import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { markdownComponents } from "~/app/_components/mdx-components";
import { getBrandPublication } from "~/lib/publishing";

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
        <section className="flex flex-col items-center pt-28 pb-16 text-center sm:pt-32 lg:pt-24">
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

        <section className="pb-20 sm:pb-28">
          <div className="relative left-1/2 aspect-video w-[min(calc(100vw-3rem),54rem)] -translate-x-1/2 overflow-hidden rounded-md bg-foreground text-background sm:w-[min(calc(100vw-5rem),56rem)] lg:w-[min(calc(100vw-16rem),58rem)]">
            <div className="flex h-full flex-col px-12 py-16 sm:px-20 lg:px-28">
              <div className="grid grid-cols-3 items-start text-background text-xs leading-none">
                <span />
                <span className="text-center">Wordmarks</span>
                <span />
              </div>
              <div className="flex flex-1 items-center justify-center">
                <Logo className="text-background" size="lg" />
              </div>
            </div>
          </div>
        </section>

        <div className="py-16 md:py-24">
          <MDXContent components={markdownComponents} />
        </div>
      </article>
    </>
  );
}
