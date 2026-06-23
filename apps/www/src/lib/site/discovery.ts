import type { MetadataRoute } from "next";
import type { StaticPublication } from "../publishing";
import { SITE_IDENTITY } from "./identity";

type SitemapPolicy = Pick<
  MetadataRoute.Sitemap[number],
  "changeFrequency" | "priority"
>;

interface LlmsPolicy {
  readonly optional?: true;
  readonly section: string;
}

interface PublicationDiscoveryPolicy {
  readonly llms: LlmsPolicy;
  readonly sitemap: SitemapPolicy;
}

export interface ExternalAuthorityEntry {
  readonly description: string;
  readonly optional: true;
  readonly section: "External Authority";
  readonly title: string;
  readonly url: string;
}

export function discoveryPolicyFor(
  publication: StaticPublication
): PublicationDiscoveryPolicy {
  switch (publication.kind) {
    case "home":
      return {
        sitemap: { changeFrequency: "weekly", priority: 1 },
        llms: { section: "Marketing" },
      };
    case "brand":
      return {
        sitemap: { changeFrequency: "monthly", priority: 0.7 },
        llms: { section: "Company" },
      };
    case "blog-index":
      return {
        sitemap: { changeFrequency: "weekly", priority: 0.8 },
        llms: { section: "Blog" },
      };
    case "blog-post":
      return {
        sitemap: { changeFrequency: "weekly", priority: 0.7 },
        llms: { section: "Blog" },
      };
    case "legal":
      return {
        sitemap: { changeFrequency: "monthly", priority: 0.4 },
        llms: { section: "Legal", optional: true },
      };
    default: {
      const exhaustive: never = publication;
      return exhaustive;
    }
  }
}

export function discoveryDescriptionFor(
  publication: StaticPublication
): string {
  if ("answerSummary" in publication && publication.answerSummary) {
    return publication.answerSummary;
  }

  return publication.description;
}

export function getExternalAuthorityEntries(): ExternalAuthorityEntry[] {
  return SITE_IDENTITY.authorityLinks.map((link) => ({
    ...link,
    section: "External Authority" as const,
    optional: true as const,
  }));
}

export function getLlmsFooter(): string[] {
  return [
    "## Contact & Support",
    "",
    `- Email: ${SITE_IDENTITY.contact.email}`,
    `- Founder: ${SITE_IDENTITY.contact.founder.name} - ${SITE_IDENTITY.contact.founder.email} - ${SITE_IDENTITY.contact.founder.url}`,
    `- Twitter: ${SITE_IDENTITY.socialLinks[0]?.url ?? ""}`,
    `- GitHub: ${SITE_IDENTITY.authorityLinks[0]?.url ?? ""}`,
    `- npm SDK: ${SITE_IDENTITY.authorityLinks[1]?.url ?? ""}`,
    `- npm MCP server: ${SITE_IDENTITY.authorityLinks[2]?.url ?? ""}`,
  ];
}
