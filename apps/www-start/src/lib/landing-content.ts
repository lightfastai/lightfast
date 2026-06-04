export const SITE_URL = "https://lightfast.ai";

export type MarketingDestination = "app" | "self" | "www";

export interface MarketingNavItem {
  title: string;
  href: string;
  destination?: MarketingDestination;
  external?: boolean;
}

export const marketingNav = {
  primary: [
    { title: "Pricing", href: "/pricing", destination: "www" },
    {
      title: "Docs",
      href: "/docs/get-started/overview",
      destination: "self",
    },
  ],
  resources: [
    { title: "Blog", href: "/blog", destination: "www" },
    { title: "Changelog", href: "/changelog", destination: "www" },
  ],
  product: [
    { title: "Pricing", href: "/pricing", destination: "www" },
    { title: "Blog", href: "/blog", destination: "www" },
    { title: "Changelog", href: "/changelog", destination: "www" },
  ],
  resourcesFooter: [
    {
      title: "Documentation",
      href: "/docs/get-started/overview",
      destination: "www",
    },
    { title: "Get started", href: "/sign-up", destination: "app" },
    {
      title: "API Reference",
      href: "/docs/api-reference/getting-started/overview",
      destination: "www",
    },
  ],
  connect: [
    { title: "Twitter", href: "https://x.com/lightfastai", external: true },
    { title: "GitHub", href: "https://github.com/lightfastai", external: true },
    { title: "Discord", href: "https://discord.gg/YqPDfcar2C", external: true },
  ],
  legal: [
    { title: "Contact", href: "mailto:hello@lightfast.ai", external: true },
    { title: "Privacy", href: "/legal/privacy", destination: "self" },
    { title: "Terms", href: "/legal/terms", destination: "self" },
  ],
} satisfies Record<string, MarketingNavItem[]>;

export const faqs = [
  {
    question: "What is Lightfast for founders?",
    answer:
      "Lightfast is the superintelligence layer for founders. Built on a unified operating layer, it observes what's happening across your tools, remembers what happened, and gives agents and people a single system to reason and act through without knowing which tools exist or how they work.",
  },
  {
    question: "What does 'operating layer' mean?",
    answer:
      "Think of Lightfast like an OS for your organization's working memory. Agents and people query a shared substrate, get grounded context, and take action through the APIs you control.",
  },
  {
    question: "How do teams use Lightfast?",
    answer:
      "Teams create an organization, invite members by email, add API keys, and query workspace memory through the REST API, TypeScript SDK, and MCP server.",
  },
  {
    question: "How does the event system work?",
    answer:
      "Lightfast stores structured observations and decisions as normalized events you can subscribe to, filter, and act on. Events are immutable and causally ordered, giving agents and workflows facts they can rely on.",
  },
  {
    question: "How do agents and AI assistants use Lightfast?",
    answer:
      "Lightfast provides a REST API, TypeScript SDK, and MCP tools that agents can use to search workspace memory, get cited answers, find related context, and express intent that Lightfast resolves to the right tool and action.",
  },
  {
    question: "How quickly can we get started?",
    answer:
      "Minutes. Sign in with email, create an organization, issue an API key, and connect AI assistants through MCP. Newly created organizations are usable immediately.",
  },
] as const;

export const landingContent = {
  seo: {
    title: "Lightfast - Superintelligence Layer for Founders",
    description:
      "Lightfast is the superintelligence layer for founders. Built on a unified operating layer that connects your tools, unifies your agents, and orchestrates your entire operation.",
  },
  hero: {
    eyebrow: "Lightfast",
    title: "Building the superintelligence layer for teams and agents.",
    cta: { title: "Get started", href: "/sign-up", destination: "app" },
    badge: {
      date: "Mar 26",
      title: "Lightfast engineering intelligence shipped",
      href: "/changelog/2026-03-26-lightfast-engineering-intelligence-shipped",
      destination: "www",
    },
  },
  featured: [
    {
      kind: "Changelog",
      title: "Lightfast engineering intelligence shipped",
      href: "/changelog/2026-03-26-lightfast-engineering-intelligence-shipped",
      destination: "www",
      publishedAt: "2026-03-26",
      image: "/images/changelog/v010-featured.webp",
    },
    {
      kind: "Blog",
      title: "Why we built Lightfast",
      href: "/blog/2026-03-26-why-we-built-lightfast",
      destination: "www",
      publishedAt: "2026-03-26",
      image: "/images/blog/why-we-built-lightfast.webp",
    },
    {
      kind: "Product",
      title: "Announcing Lightfast",
      href: "/changelog/2026-03-26-lightfast-engineering-intelligence-shipped",
      destination: "www",
      publishedAt: "2026-03-26",
      image: "/images/announcing-lightfast.webp",
    },
  ],
  cta: {
    title: "Try Lightfast now.",
    href: "/sign-up",
    destination: "app",
  },
} as const;

type GraphEntity =
  | {
      "@type": "Organization";
      "@id": string;
      name: string;
      url: string;
      logo: { "@type": "ImageObject"; url: string };
      sameAs: string[];
      description: string;
    }
  | {
      "@type": "WebSite";
      "@id": string;
      url: string;
      name: string;
      description: string;
      publisher: { "@id": string };
    }
  | {
      "@type": "SoftwareApplication";
      "@id": string;
      name: string;
      applicationCategory: string;
      operatingSystem: string;
      offers: {
        "@type": "Offer";
        price: string;
        priceCurrency: string;
        url: string;
      };
      description: string;
      featureList: string[];
    }
  | {
      "@type": "FAQPage";
      "@id": string;
      mainEntity: Array<{
        "@type": "Question";
        name: string;
        acceptedAnswer: { "@type": "Answer"; text: string };
      }>;
    };

export function buildLandingHead() {
  return {
    meta: [
      { title: landingContent.seo.title },
      {
        name: "description",
        content: landingContent.seo.description,
      },
      {
        name: "keywords",
        content:
          "superintelligence, AI for founders, founder tools, operating infrastructure, agent infrastructure, MCP tools, AI agent platform, operating layer, agents and apps",
      },
      { property: "og:title", content: landingContent.seo.title },
      {
        property: "og:description",
        content: landingContent.seo.description,
      },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Lightfast" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: landingContent.seo.title },
      {
        name: "twitter:description",
        content: landingContent.seo.description,
      },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  };
}

export function buildLandingStructuredData(): {
  "@context": "https://schema.org";
  "@graph": GraphEntity[];
} {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
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
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Lightfast",
        description:
          "Superintelligence layer for founders built on a unified operating layer to observe, remember, and act across every tool.",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: "Lightfast",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, API",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          url: `${SITE_URL}/sign-up`,
        },
        description:
          "The superintelligence layer for founders. Observe events, build memory, and orchestrate action across your entire tool stack through a single system.",
        featureList: [
          "Real-time event ingestion through controlled APIs",
          "Semantic search with cited sources",
          "MCP tools for AI agents",
          "REST API and TypeScript SDK",
          "Intent-based action resolution",
          "Complete tenant isolation",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}
