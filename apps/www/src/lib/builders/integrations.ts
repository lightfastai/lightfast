import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import type {
  GraphContext,
  SoftwareApplication,
  WebPage,
} from "@vendor/seo/json-ld";
import type { IntegrationPageData } from "~/lib/content-schemas";
import type { IntegrationUrl } from "~/lib/url-types";
import {
  buildBreadcrumbList,
  buildFaqEntity,
  buildOrganizationEntity,
  buildWebSiteEntity,
} from "./shared";

function buildIntegrationPageEntity(
  data: IntegrationPageData,
  url: IntegrationUrl
): Omit<WebPage, "@id" | "url"> {
  const hasProvider = data.status !== "planned";
  return {
    "@type": "WebPage",
    name: data.title,
    description: data.description,
    dateModified: data.updatedAt,
    inLanguage: "en-US",
    isPartOf: { "@id": "https://lightfast.ai/#website" },
    publisher: { "@id": "https://lightfast.ai/#organization" },
    ...(hasProvider ? { about: { "@id": `${url}#integrated-app` } } : {}),
    keywords: data.keywords.join(", "),
  };
}

function buildIntegratedAppEntity(
  data: IntegrationPageData,
  url: IntegrationUrl
): SoftwareApplication | null {
  if (data.status === "planned") {
    return null;
  }
  const display = PROVIDER_DISPLAY[data.providerId];
  return {
    "@type": "SoftwareApplication",
    "@id": `${url}#integrated-app`,
    name: display.displayName,
    description: display.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
  };
}

export function buildIntegrationJsonLd(
  data: IntegrationPageData,
  url: IntegrationUrl
): GraphContext {
  const entity = buildIntegrationPageEntity(data, url);
  const integratedApp = buildIntegratedAppEntity(data, url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationEntity(),
      buildWebSiteEntity(),
      { ...entity, "@id": `${url}#webpage`, url },
      ...(integratedApp ? [integratedApp] : []),
      ...(data.faq && data.faq.length > 0
        ? [buildFaqEntity(data.faq, url)]
        : []),
      buildBreadcrumbList([
        { name: "Home", url: "https://lightfast.ai" },
        { name: "Integrations", url: "https://lightfast.ai/integrations" },
        { name: data.title, url },
      ]),
    ],
  };
}
