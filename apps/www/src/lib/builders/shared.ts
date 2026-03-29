import type {
  Answer,
  BreadcrumbList,
  FAQPage,
  ListItem,
  Organization,
  Question,
  WebSite,
} from "@vendor/seo/json-ld";

export interface Crumb {
  name: string;
  url: string;
}

export function buildOrganizationEntity(): Organization {
  return {
    "@type": "Organization",
    "@id": "https://lightfast.ai/#organization",
    name: "Lightfast",
    url: "https://lightfast.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://lightfast.ai/og.png",
    },
    sameAs: [
      "https://x.com/lightfastai",
      "https://github.com/lightfastai",
      "https://www.linkedin.com/company/lightfastai",
    ],
  };
}

export function buildWebSiteEntity(): WebSite {
  return {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/#website",
    name: "Lightfast",
    url: "https://lightfast.ai",
    publisher: { "@id": "https://lightfast.ai/#organization" },
  };
}

export function buildBreadcrumbList(crumbs: Crumb[]): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    "@id": `${crumbs.at(-1)?.url ?? ""}#breadcrumb`,
    itemListElement: crumbs.map(
      (crumb, index) =>
        ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        }) satisfies ListItem
    ),
  };
}

export function buildFaqEntity(
  items: Array<{ question: string; answer: string }>,
  pageId: string
): FAQPage {
  return {
    "@type": "FAQPage",
    "@id": `${pageId}#faq`,
    mainEntity: items.map(
      (item) =>
        ({
          "@type": "Question" as const,
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer" as const,
            text: item.answer,
          } satisfies Answer,
        }) satisfies Question
    ),
  };
}
