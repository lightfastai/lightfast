import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
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
import { McpBentoSection } from "./_components/mcp-bento";
import { UpcomingIntegrationsList } from "./_components/upcoming-integrations-list";

export const dynamic = "force-static";

const PAGE_TITLE = "Integrations";
const PAGE_DESCRIPTION =
  "Connect Lightfast to the tools your engineering org runs on. GitHub, Vercel, Linear today — Sentry, PagerDuty, Stripe, Clerk, and 30+ more on the roadmap.";
const PAGE_URL = "https://lightfast.ai/integrations";
const FAQ = [
  {
    question: "What integrations does Lightfast support today?",
    answer:
      "GitHub, Vercel, and Linear are live. Each ingests events via OAuth and webhooks in real-time — pull requests, deploys, issues, and more.",
  },
  {
    question: "What's on the roadmap?",
    answer:
      "37 planned integrations — each with its own dedicated page — spanning error tracking (Sentry, Datadog), incident response (PagerDuty, incident.io), billing (Stripe), auth (Clerk, WorkOS), product analytics (PostHog, Mixpanel, Amplitude), support (Intercom, Plain), CRM (HubSpot, Attio), and more. Click any row in the roadmap list to see per-integration details.",
  },
  {
    question: "Can I request an integration or vote on priority?",
    answer:
      "Yes. Reach out from any live integration page — demand from design-partner teams drives our roadmap order.",
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
    "sentry integration",
    "pagerduty integration",
    "stripe integration",
    "clerk integration",
    "posthog integration",
    "datadog integration",
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
  const pages = getIntegrationPages().filter(
    (p) => p.data.status === "live"
  );

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
    <>
      <JsonLd code={structuredData} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-16">
        {/* Left: Badge */}
        <div>
          <span className="inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-sm">
            Integrations
          </span>
        </div>

        {/* Right: Live integrations - spans 2 columns */}
        <div className="lg:col-span-2">
          <div className="mb-8 border-border border-b pb-8">
            <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
              Live today — GitHub, Vercel, and Linear ingest events in real
              time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pages.map((page) => {
              const { iconKey, title, tagline } = page.data;
              const Icon = IntegrationLogoIcons[iconKey];
              const slug = page.slugs[0] ?? "";

              return (
                <NavLink
                  className="group flex h-[180px] flex-col justify-between gap-4 overflow-hidden rounded-md border border-border/50 bg-accent/20 p-6 transition-colors hover:bg-accent/40 md:h-[220px]"
                  href={`/integrations/${slug}` as Route}
                  key={slug}
                  prefetch
                >
                  {Icon && (
                    <Icon aria-hidden className="size-5 text-foreground" />
                  )}
                  <div className="flex flex-col gap-2">
                    <h2 className="font-medium font-pp text-foreground text-lg">
                      {title}
                    </h2>
                    <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                      {tagline}
                    </p>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
      <UpcomingIntegrationsList />
      <McpBentoSection />
    </>
  );
}
