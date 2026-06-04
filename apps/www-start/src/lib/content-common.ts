import { parse } from "yaml";
import { SITE_URL } from "~/lib/landing-content";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface RouteHead {
  meta: Array<Record<string, string>>;
  links?: Array<Record<string, string>>;
}

export interface JsonLdGraph {
  "@context": "https://schema.org";
  "@graph": unknown[];
}

export function parseFrontmatter(source: string, label: string) {
  const match = source.match(frontmatterPattern);

  if (!match) {
    throw new Error(`Missing frontmatter in content document: ${label}`);
  }

  const [, frontmatter] = match;
  return {
    frontmatter: parse(frontmatter ?? ""),
    body: source.slice(match[0].length).trimStart(),
  };
}

export function buildRobots(data: { nofollow: boolean; noindex: boolean }) {
  return [
    data.noindex ? "noindex" : "index",
    data.nofollow ? "nofollow" : "follow",
  ].join(", ");
}

export function formatDisplayDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
) {
  return new Date(iso).toLocaleDateString("en-US", options);
}

export function buildOrganizationEntity() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Lightfast",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/android-chrome-512x512.png`,
    },
    sameAs: [
      "https://twitter.com/lightfastai",
      "https://github.com/lightfastai",
      "https://www.linkedin.com/company/lightfastai",
    ],
    description:
      "Lightfast is the superintelligence layer for founders, built on a unified operating layer that connects tools, unifies agents, and orchestrates entire operations.",
  };
}

export function buildWebSiteEntity() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "Lightfast",
    description:
      "Superintelligence layer for founders built on a unified operating layer to observe, remember, and act across every tool.",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function buildFaqEntity(
  faq: readonly { answer: string; question: string }[],
  url: string
) {
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbList(
  items: readonly { name: string; url: string }[]
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
