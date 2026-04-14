import type { BlogCategory } from "~/lib/content-schemas";

export interface BlogCategoryMeta {
  readonly description: string;
  readonly faq: readonly { question: string; answer: string }[];
  readonly heading: string;
  readonly keywords: readonly string[];
  readonly ogTitle: string;
  readonly slug: BlogCategory;
  readonly tagline: string;
  readonly title: string;
}

export const BLOG_CATEGORY_META: Record<BlogCategory, BlogCategoryMeta> = {
  engineering: {
    slug: "engineering",
    title: "Engineering",
    heading: "Blog — Engineering",
    tagline:
      "Deep-dives on AI agent orchestration, event-driven architecture, and operating infrastructure.",
    description:
      "Engineering deep-dives from the Lightfast team on AI agent orchestration, event ingestion pipelines, and the infrastructure behind autonomous systems.",
    ogTitle: "Blog — Engineering",
    keywords: [
      "lightfast engineering blog",
      "ai agent orchestration",
      "event-driven architecture",
      "mcp tools",
      "inngest workflows",
      "agent infrastructure",
      "token vault",
      "llm engineering",
    ],
    faq: [
      {
        question: "What engineering topics does the Lightfast blog cover?",
        answer:
          "AI agent orchestration, event ingestion pipelines, MCP tool design, Inngest workflows, token vaults, graph stores, and operational patterns for running AI infrastructure in production.",
      },
      {
        question: "Who writes the engineering posts?",
        answer:
          "Engineering posts are written by the Lightfast engineers who built the systems they describe — not by marketing or a ghostwriter.",
      },
      {
        question: "How often are new engineering posts published?",
        answer:
          "We publish engineering deep-dives as we ship significant infrastructure work, typically a few times per month.",
      },
    ],
  },
  product: {
    slug: "product",
    title: "Product",
    heading: "Blog — Product",
    tagline:
      "Launches, changelog highlights, and the reasoning behind the product decisions we ship.",
    description:
      "Product updates from Lightfast — launch announcements, feature deep-dives, and the thinking behind the decisions we make on our superintelligence layer for founders.",
    ogTitle: "Blog — Product",
    keywords: [
      "lightfast product updates",
      "ai agent platform",
      "product launches",
      "feature announcements",
      "superintelligence layer",
      "founder tools",
      "ai product decisions",
      "lightfast roadmap",
    ],
    faq: [
      {
        question: "What product updates are covered here?",
        answer:
          "Feature launches, new surfaces in the Lightfast console, integrations with providers like GitHub and Linear, and the reasoning behind product decisions we've shipped.",
      },
      {
        question: "How do product posts differ from the changelog?",
        answer:
          "The changelog is a terse list of what changed in each release. Product posts unpack the why — the motivation, tradeoffs, and the design thinking behind major launches.",
      },
      {
        question: "Where should I go to see the full release history?",
        answer:
          "The /changelog page is the canonical feed for every release. Product blog posts are reserved for launches significant enough to warrant a longer-form explanation.",
      },
    ],
  },
  company: {
    slug: "company",
    title: "Company",
    heading: "Blog — Company",
    tagline:
      "Founder letters, team updates, and the story behind building Lightfast in public.",
    description:
      "Company updates from Lightfast — founder letters, team milestones, hiring, fundraising, and the story of building an AI infrastructure company in public.",
    ogTitle: "Blog — Company",
    keywords: [
      "lightfast company",
      "founder letter",
      "ai startup",
      "building in public",
      "hiring ai company",
      "startup milestones",
      "lightfast team",
      "ai infrastructure startup",
    ],
    faq: [
      {
        question: "What's in the company section of the blog?",
        answer:
          "Founder letters, team updates, hiring announcements, fundraising news, and milestones from building Lightfast. It's the human side of the company, not the technical side.",
      },
      {
        question: "Is Lightfast hiring?",
        answer:
          "We post open roles on /careers and announce notable team additions here. If a role isn't listed, we're probably not actively hiring for it yet — but introductions are welcome.",
      },
      {
        question: "How often do company posts publish?",
        answer:
          "Rarely on purpose. We only post when something real happens — a launch, a raise, a hire, a strategic shift worth sharing — rather than on a content calendar.",
      },
    ],
  },
  tutorial: {
    slug: "tutorial",
    title: "Tutorial",
    heading: "Blog — Tutorials",
    tagline:
      "Step-by-step guides for building with Lightfast, MCP tools, and agent orchestration.",
    description:
      "Step-by-step tutorials from Lightfast on building with the platform, wiring up MCP tools, orchestrating AI agents, and integrating with GitHub, Linear, and more.",
    ogTitle: "Blog — Tutorials",
    keywords: [
      "lightfast tutorial",
      "ai agent tutorial",
      "mcp tool guide",
      "agent orchestration tutorial",
      "lightfast sdk examples",
      "how to build ai agents",
      "github integration tutorial",
      "linear integration tutorial",
    ],
    faq: [
      {
        question: "What kind of tutorials are published here?",
        answer:
          "Hands-on guides for building with Lightfast: SDK usage, MCP tool authoring, agent orchestration patterns, provider integrations, and operational playbooks for production.",
      },
      {
        question: "Are the tutorials kept up to date?",
        answer:
          "Tutorials are written against the current version of Lightfast and tested before publication. When a breaking change lands, we update affected tutorials rather than letting them drift.",
      },
      {
        question: "Where can I find the reference documentation?",
        answer:
          "Reference lives at /docs — concepts, API reference, and configuration. Tutorials here complement the docs by walking through complete end-to-end workflows.",
      },
    ],
  },
  research: {
    slug: "research",
    title: "Research",
    heading: "Blog — Research",
    tagline:
      "Benchmarks, evaluations, and applied research on agent behavior, tool use, and memory.",
    description:
      "Applied research from Lightfast on agent behavior, MCP tool use, evaluation methodology, memory systems, and benchmarks we run to understand how AI agents actually perform.",
    ogTitle: "Blog — Research",
    keywords: [
      "lightfast research",
      "ai agent benchmarks",
      "llm evaluation",
      "mcp tool use research",
      "agent memory research",
      "applied ai research",
      "agent planning",
      "ai evaluation methodology",
    ],
    faq: [
      {
        question: "What kind of research does Lightfast publish?",
        answer:
          "Applied research on agent behavior, tool use, memory systems, and evaluation methodology — benchmarks, ablations, and writeups of what we learn running agents in production.",
      },
      {
        question: "Are the benchmarks reproducible?",
        answer:
          "Yes — we publish methodology, prompts, and scoring so readers can reproduce the results. When we can't release a dataset, we explain why and what we used in its place.",
      },
      {
        question: "Is this academic research or engineering research?",
        answer:
          "Engineering research. We care about what holds up in production, not what looks good on a leaderboard. Results are framed around the operational decisions they informed.",
      },
    ],
  },
};
