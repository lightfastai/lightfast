import type { GraphContext, WebPage } from "@vendor/seo/json-ld";
import type { LegalPageData } from "~/lib/content-schemas";
import type { LegalUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

function buildLegalPageEntity(
  data: LegalPageData
): Omit<WebPage, "@id" | "url"> {
  return {
    "@type": "WebPage",
    name: data.title,
    description: data.description,
    dateModified: data.updatedAt,
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
  };
}

export function buildLegalJsonLd(
  data: LegalPageData,
  url: LegalUrl
): GraphContext {
  const entity = buildLegalPageEntity(data);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#webpage`, url },
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: data.title, url },
      ]),
    ],
  };
}
