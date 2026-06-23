import { createLlmsTxtHandler, type PageEntry } from "@vendor/aeo";
import {
  getPublicPublications,
  type StaticPublication,
} from "~/lib/publishing";
import {
  discoveryDescriptionFor,
  discoveryPolicyFor,
  getExternalAuthorityEntries,
  getLlmsFooter,
} from "~/lib/site/discovery";
import { SITE_IDENTITY } from "~/lib/site/identity";

export const revalidate = false;

function pageEntryFor(publication: StaticPublication): PageEntry {
  const { llms: policy } = discoveryPolicyFor(publication);

  return {
    url: publication.canonicalUrl,
    title: publication.title,
    description: discoveryDescriptionFor(publication),
    lastModified: publication.lastModified,
    section: policy.section,
    ...(policy.optional ? { optional: true } : {}),
  };
}

const providers: Array<() => Promise<PageEntry[]>> = [
  () => {
    const entries: PageEntry[] = getPublicPublications().map(pageEntryFor);

    entries.push(...getExternalAuthorityEntries());

    return Promise.resolve(entries);
  },
];

export const { GET } = createLlmsTxtHandler(
  providers,
  {
    title: SITE_IDENTITY.name,
    description: SITE_IDENTITY.description,
    baseUrl: SITE_IDENTITY.baseUrl,
    sectionOrder: [
      "Marketing",
      "Company",
      "Blog",
      "Legal",
      "External Authority",
    ],
    defaultSection: "Marketing",
    footer: getLlmsFooter(),
  },
  { cacheControl: "public, max-age=86400, s-maxage=86400" },
  {
    skipUrl: [/\/search(\b|\/)/, /\/pitch-deck/],
    stripTitleSuffix: SITE_IDENTITY.name,
  }
);
