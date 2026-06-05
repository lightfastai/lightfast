import { SITE_URL } from "~/lib/landing-content";

export const pricingContent = {
  seo: {
    title: "Lightfast Pricing - Scales With Your Team",
    description:
      "Start free for up to 3 users. Scale your operating layer as your team grows - add more teammates, search more context, give more agents access.",
    openGraph: {
      title: "Lightfast Pricing - Scales With Your Team",
      description:
        "Pricing for Lightfast. Start free and scale with simple per-user pricing, team search, and API access.",
      url: `${SITE_URL}/pricing`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Lightfast Pricing",
      description:
        "For every size team. Start free, scale transparently. Semantic search and API access available.",
    },
  },
} as const;

export const pricingFaqs = [
  {
    question: "What makes Lightfast worth $20/user?",
    answer:
      "Lightfast gives your team perfect memory. Find any decision, code change, or discussion instantly. Know who worked on what and why. Track how things evolved over time. For a 10-person team at $200/month, you're saving hours of context searching every week. That's easily worth 10x the cost in saved developer time.",
  },
  {
    question: "What's included in the search allowance?",
    answer:
      "Each user on Team plan gets 1,500 searches/month. A search is any query through Lightfast search, similar content, or AI-generated answers. For a 10-person team, that's 15,000 searches included. Most teams use 200-500 searches per user monthly. Extra searches are just $5 per 1,000. Business plan includes unlimited searches.",
  },
  {
    question: "How do add-ons work?",
    answer:
      "Team plans can add extra searches and longer retention as needed. You can also add 180-day retention (+$20/mo) or extra searches at $5 per 1,000 searches.",
  },
  {
    question: "What's included in decision surfacing?",
    answer:
      "Lightfast captures decisions, incidents, and changes from your tools. It builds expertise profiles to know who worked on what, tracks evolution over time, and generates summaries. This enables powerful queries like 'who knows about auth' or 'what decisions were made about PostgreSQL'. It's included in all paid plans.",
  },
  {
    question: "Why charge per user instead of just usage?",
    answer:
      "Per-user pricing ensures predictable costs and aligns with value - more team members means more knowledge to organize and search. However, we include generous search allowances and charge minimal amounts for overages, so you're not penalized for active usage. This hybrid model is fairer than pure per-seat or pure usage-based pricing.",
  },
  {
    question: "What happens if we exceed our search limit?",
    answer:
      "Your searches continue working seamlessly. We'll notify you at 80% usage. Overages are automatically billed at $5 per 1,000 searches on the Team plan. You can track usage in real-time and upgrade anytime for better rates. Business plan includes unlimited searches.",
  },
  {
    question: "Can small teams use the Starter plan?",
    answer:
      "Yes! Starter plan is free forever for up to 3 users with 2,500 searches/month total. Perfect for small teams, open source projects, or trying Lightfast. You get basic keyword search and 14-day retention. Upgrade to Team when you need semantic search, decision surfacing, and more team capacity.",
  },
  {
    question: "How does Business plan differ from Team?",
    answer:
      "Business includes unlimited searches, 1-year retention, advanced decision surfacing with auto-summaries, actor expertise profiles, full identity mapping, temporal state tracking, SLA guarantees, and dedicated support. It's designed for larger organizations that need custom terms. Contact sales for custom pricing.",
  },
  {
    question: "How do we estimate which plan we need?",
    answer:
      "Start with Starter if you're 1-3 people just trying Lightfast. Choose Team if you're 3-50 people and need semantic search and decision surfacing. Most teams use 200-500 searches per user monthly, well within the 1,500 included. If you need custom retention, SLA guarantees, or advanced features, choose Business. You can always start small and upgrade as you grow.",
  },
] as const;

type PricingFaq = (typeof pricingFaqs)[number];

interface PricingFaqPageStructuredData {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: PricingFaq["question"];
    acceptedAnswer: {
      "@type": "Answer";
      text: PricingFaq["answer"];
    };
  }>;
}

interface PricingSoftwareStructuredData {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  applicationCategory: "DeveloperApplication";
  isAccessibleForFree: true;
  license: string;
  name: "Lightfast";
  offers: Array<{
    "@type": "Offer";
    name: string;
    price?: string;
    priceCurrency: "USD";
    availability: "https://schema.org/InStock";
    description: string;
  }>;
  url: typeof SITE_URL;
}

export function buildPricingHead() {
  return {
    meta: [
      { title: pricingContent.seo.title },
      {
        name: "description",
        content: pricingContent.seo.description,
      },
      { property: "og:title", content: pricingContent.seo.openGraph.title },
      {
        property: "og:description",
        content: pricingContent.seo.openGraph.description,
      },
      { property: "og:url", content: pricingContent.seo.openGraph.url },
      { property: "og:type", content: pricingContent.seo.openGraph.type },
      { name: "twitter:card", content: pricingContent.seo.twitter.card },
      { name: "twitter:title", content: pricingContent.seo.twitter.title },
      {
        name: "twitter:description",
        content: pricingContent.seo.twitter.description,
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pricing` }],
  };
}

export function buildPricingFaqStructuredData(): PricingFaqPageStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pricingFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildPricingSoftwareStructuredData(): PricingSoftwareStructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Lightfast",
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    offers: [
      {
        "@type": "Offer",
        name: "Starter",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "Up to 3 users, 2,500 searches/month, 14-day retention",
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "20",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "$20 per user/month. 1,500 searches per user, semantic search, decision surfacing included",
      },
      {
        "@type": "Offer",
        name: "Business",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description:
          "Contact us for enterprise pricing. Unlimited searches, advanced decision surfacing, SLA guarantees",
      },
    ],
    isAccessibleForFree: true,
    license: "https://github.com/lightfastai/lightfast/blob/main/LICENSE",
  };
}
