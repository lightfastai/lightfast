import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import type { GraphContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";
import type { Metadata, Route } from "next";
import { getIntegrationPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";
import {
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "~/lib/builders";
import { createMetadata } from "~/lib/content-seo";
import { getProviderIcon } from "~/lib/get-provider-icon";

export const dynamic = "force-static";

const PAGE_TITLE = "Integrations";
const PAGE_DESCRIPTION =
  "Connect Lightfast to the tools your engineering org already runs on. GitHub, Vercel, Linear, Sentry, and more — one integration, every event.";
const PAGE_URL = "https://lightfast.ai/integrations";
const FAQ = [
  {
    question: "What integrations does Lightfast support?",
    answer:
      "Lightfast integrates with GitHub and Vercel today, with Linear, Sentry, and Apollo shipping next. Each integration ingests events in real-time via OAuth and webhooks.",
  },
  {
    question: "How do I connect an integration?",
    answer:
      "Install the integration from your Lightfast workspace under Settings → Integrations. OAuth flow completes in under a minute; events start flowing immediately.",
  },
  {
    question: "Can I request a new integration?",
    answer:
      "Yes. Join the waitlist from any coming-soon integration page — demand drives our roadmap prioritisation.",
  },
];

export const metadata: Metadata = createMetadata({
  title: `${PAGE_TITLE} | Lightfast`,
  description: PAGE_DESCRIPTION,
  keywords: [
    "lightfast integrations",
    "github integration",
    "vercel integration",
    "linear integration",
    "engineering intelligence integrations",
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Lightfast Integrations",
    description: PAGE_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
    siteName: "Lightfast",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lightfast Integrations",
    description: PAGE_DESCRIPTION,
    site: "@lightfastai",
    creator: "@lightfastai",
  },
});

export default function IntegrationsIndexPage() {
  const pages = getIntegrationPages();

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      {
        "@type": "WebPage" as const,
        "@id": `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: "Lightfast Integrations",
        description: PAGE_DESCRIPTION,
        isPartOf: { "@id": "https://lightfast.ai/#website" },
        publisher: { "@id": "https://lightfast.ai/#organization" },
      },
      buildFaqEntity(FAQ, PAGE_URL),
    ],
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl pt-24 pb-32">
      <JsonLd code={structuredData} />
      <div className="mb-12">
        <h1 className="mb-4 font-medium font-pp text-4xl text-foreground">
          Integrations
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
          {PAGE_DESCRIPTION}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => {
          const { providerId, status: mdxStatus, title, tagline } = page.data;
          const providerComingSoon =
            providerId && "comingSoon" in PROVIDER_DISPLAY[providerId]
              ? PROVIDER_DISPLAY[providerId].comingSoon
              : false;
          const derivedStatus: "live" | "beta" | "coming-soon" =
            mdxStatus ?? (providerComingSoon ? "coming-soon" : "live");
          const Icon = providerId ? getProviderIcon(providerId) : undefined;
          const slug = page.slugs[0] ?? "";

          return (
            <NavLink
              className="group flex h-full flex-col gap-4 rounded-lg border border-border/50 bg-card/40 p-6 transition-colors hover:border-border hover:bg-card"
              href={`/integrations/${slug}` as Route}
              key={slug}
              prefetch
            >
              <div className="flex items-center justify-between">
                {Icon && (
                  <Icon aria-hidden className="size-8 text-foreground" />
                )}
                {derivedStatus !== "live" && (
                  <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs uppercase tracking-wider">
                    {derivedStatus === "coming-soon" ? "Soon" : "Beta"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="font-medium font-pp text-foreground text-xl">
                  {title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tagline}
                </p>
              </div>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
