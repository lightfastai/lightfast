import { SITE_URL } from "~/lib/landing-content";

export const useCaseSlugs = [
  "agent-builders",
  "engineering-leaders",
  "platform-engineers",
  "technical-founders",
] as const;

export type UseCaseSlug = (typeof useCaseSlugs)[number];

export interface UseCasePage {
  url: string;
  data: {
    title: string;
    description: string;
  };
}

const useCaseContent = {
  "agent-builders": {
    title: "Lightfast for Agent Builders - Build the Superintelligence Layer",
    description:
      "Give your agents a single system to observe, reason, and act across every tool. REST API, MCP tools, and webhooks - integrate in minutes.",
    openGraphTitle: "Lightfast for Agent Builders",
    openGraphDescription:
      "Give your agents a single system to observe, reason, and act across every tool. REST API, MCP tools, and webhooks.",
  },
  "engineering-leaders": {
    title: "Lightfast for Engineering Leaders - Superintelligence for Your Team",
    description:
      "See what's happening across your engineering org in real time. Events from every tool, surfaced and searchable - so your team operates as one.",
    openGraphTitle: "Lightfast for Engineering Leaders",
    openGraphDescription:
      "See what's happening across your engineering org in real time. Events from every tool, surfaced and searchable.",
  },
  "platform-engineers": {
    title:
      "Lightfast for Platform Engineers - Superintelligence for Your Platform",
    description:
      "Connect your infrastructure tools through a single operating layer. Ingest events from GitHub, Vercel, Sentry, Linear, and more - with complete tenant isolation.",
    openGraphTitle: "Lightfast for Platform Engineers",
    openGraphDescription:
      "Connect your infrastructure tools through a single operating layer. Ingest events from GitHub, Vercel, Sentry, Linear, and more.",
  },
  "technical-founders": {
    title: "Lightfast for Technical Founders - Superintelligence for Your Stack",
    description:
      "Ship the operating layer between your agents and tools. One system for observing, remembering, and acting across your entire engineering stack.",
    openGraphTitle: "Lightfast for Technical Founders",
    openGraphDescription:
      "Ship the operating layer between your agents and tools. One system for observing, remembering, and acting across your entire stack.",
  },
} satisfies Record<
  UseCaseSlug,
  {
    description: string;
    openGraphDescription: string;
    openGraphTitle: string;
    title: string;
  }
>;

export function buildUseCaseHead(slug: UseCaseSlug) {
  const content = useCaseContent[slug];
  const url = `${SITE_URL}/use-cases/${slug}`;

  return {
    meta: [
      { title: content.title },
      { name: "description", content: content.description },
      { property: "og:title", content: content.openGraphTitle },
      {
        property: "og:description",
        content: content.openGraphDescription,
      },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function getUseCasePages(): UseCasePage[] {
  return useCaseSlugs.map((slug) => {
    const content = useCaseContent[slug];

    return {
      url: `${SITE_URL}/use-cases/${slug}`,
      data: {
        title: content.openGraphTitle,
        description: content.description,
      },
    };
  });
}
