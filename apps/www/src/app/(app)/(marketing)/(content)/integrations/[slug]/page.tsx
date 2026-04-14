import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mdxComponents } from "~/app/(app)/(content)/_lib/mdx-components";
import {
  getIntegrationPage,
  getIntegrationPages,
} from "~/app/(app)/(content)/_lib/source";
import { getProviderIcon } from "~/lib/get-provider-icon";
import { emitIntegrationSeo } from "~/lib/seo-bundle";
import type { IntegrationUrl } from "~/lib/url-types";
import { IntegrationHero } from "../_components/integration-hero";

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

  const { title, tagline, providerId, status: mdxStatus } = page.data;
  const providerComingSoon =
    providerId && "comingSoon" in PROVIDER_DISPLAY[providerId]
      ? PROVIDER_DISPLAY[providerId].comingSoon
      : false;
  const derivedStatus: "live" | "beta" | "coming-soon" =
    mdxStatus ?? (providerComingSoon ? "coming-soon" : "live");
  const Icon = providerId ? getProviderIcon(providerId) : undefined;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl pt-24 pb-32">
      <JsonLd code={jsonLd} />
      <IntegrationHero
        icon={Icon}
        status={derivedStatus}
        tagline={tagline}
        title={title}
      />
      <div className="mt-8 max-w-none">
        <MDXContent components={mdxComponents} />
      </div>
    </div>
  );
}
