import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import {
  getIntegrationPage,
  getIntegrationPages,
} from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import { emitIntegrationSeo } from "~/lib/seo-bundle";
import type { IntegrationUrl } from "~/lib/url-types";
import { STATUS_LABEL } from "../_components/integration-labels";
import { IntegrationSidebar } from "../_components/integration-sidebar";

export const dynamic = "force-static";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getIntegrationPages().map((page) => ({ slug: page.slugs[0] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  if (!page) {
    return {};
  }
  const url = `https://lightfast.ai/integrations/${slug}` as IntegrationUrl;
  const { metadata } = emitIntegrationSeo(page.data, url);
  return metadata;
}

export default async function IntegrationDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getIntegrationPage([slug]);
  if (!page) {
    notFound();
  }

  const url = `https://lightfast.ai/integrations/${slug}` as IntegrationUrl;
  const { jsonLd } = emitIntegrationSeo(page.data, url);
  const MDXContent = page.data.body;

  const { title, tagline, status, category, iconKey } = page.data;
  const featuredImage =
    page.data.status === "planned" ? undefined : page.data.featuredImage;
  const docsUrl =
    page.data.status === "planned" ? undefined : page.data.docsUrl;
  const Icon = IntegrationLogoIcons[iconKey];

  return (
    <>
      <JsonLd code={jsonLd} />
      <article className="space-y-8">
        <p className="text-muted-foreground text-sm">
          <Button
            asChild
            className="h-auto p-0 text-muted-foreground text-sm hover:text-foreground"
            variant="link"
          >
            <NavLink href="/integrations">Integrations</NavLink>
          </Button>
          {" / "}
          {title}
          {status !== "live" && (
            <>
              {" · "}
              {STATUS_LABEL[status]}
            </>
          )}
        </p>

        <p className="max-w-2xl text-foreground text-lg leading-relaxed">
          {tagline}
        </p>

        <Separator className="bg-border/50" />

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-8">
            {featuredImage && (
              <div className="relative aspect-16/9 overflow-hidden">
                <Image
                  alt={title}
                  className="h-full w-full object-cover"
                  fill
                  priority
                  src={featuredImage}
                />
              </div>
            )}
            <div className="max-w-none">
              <MDXContent components={mdxComponents} />
            </div>
          </div>

          <IntegrationSidebar
            category={category}
            docsUrl={docsUrl}
            icon={Icon}
            status={status}
            title={title}
          />
        </div>

        {(() => {
          const related = getIntegrationPages().filter(
            (p) => p.data.status === "live" && p.slugs[0] !== slug
          );
          if (related.length === 0) {
            return null;
          }
          return (
            <section className="pt-16">
              <h2 className="mb-6 font-medium font-pp text-xl">
                Other integrations
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => {
                  const rSlug = p.slugs[0] ?? "";
                  const RIcon = IntegrationLogoIcons[p.data.iconKey];
                  return (
                    <NavLink
                      className="group flex h-[200px] flex-col justify-between gap-6 overflow-hidden rounded-md bg-accent/40 p-6 transition-colors hover:bg-accent"
                      href={`/integrations/${rSlug}` as Route}
                      key={rSlug}
                      prefetch
                    >
                      {RIcon && (
                        <RIcon aria-hidden className="size-5 text-foreground" />
                      )}
                      <div className="flex flex-col gap-3">
                        <h3 className="font-medium font-pp text-foreground text-xl">
                          {p.data.title}
                        </h3>
                        <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                          {p.data.tagline}
                        </p>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </section>
          );
        })()}
      </article>
    </>
  );
}
