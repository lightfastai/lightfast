import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, MessageSquare, Users } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";
import { FeatureShowcase } from "~/components/feature-showcase";
import { SemanticSearchVisual } from "~/components/landing/semantic-search-visual";
import { OwnershipVisual } from "~/components/landing/ownership-visual";
import { NeuralMemoryVisual } from "~/components/landing/neural-memory-visual";
import { CitationsVisual } from "~/components/landing/citations-visual";

const memoryTypes = [
  {
    icon: GitBranch,
    title: "Documents & Code",
    description:
      "Pull requests, issues, docs, and discussions from GitHub, Linear, Notion, Slack, and more.",
  },
  {
    icon: MessageSquare,
    title: "Decisions & Context",
    description:
      "Why decisions were made, what was discussed, and who was involved.",
  },
  {
    icon: Users,
    title: "People & Ownership",
    description:
      "Who owns what, who worked on what, and who has context on any topic.",
  },
];

const relatedPages = [
  {
    title: "For Agents",
    href: "/features/agents",
    description: "Give your AI agents access to memory layer. MCP tools and REST API.",
  },
  {
    title: "Connectors",
    href: "/features/connectors",
    description:
      "Connect your existing tools. GitHub, Slack, Notion, and more.",
  },
  {
    title: "Documentation",
    href: "/docs/get-started/overview",
    description: "Get started with the Lightfast API in minutes.",
  },
];

export const metadata: Metadata = createMetadata({
  title: "Memory – Memory Layer for Software Teams | Lightfast",
  description:
    "Capture decisions, ownership, and context as it happens. Search by meaning, not keywords. Every answer shows its source.",
  openGraph: {
    title: "Memory – Memory Layer for Software Teams",
    description:
      "Capture decisions, ownership, and context as it happens. Search by meaning, not keywords.",
    url: "https://lightfast.ai/features/memory",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/features/memory",
  },
});

export default function MemoryPage() {
  return (
    <div className="mt-6 flex w-full flex-col gap-24 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <div className="max-w-2xl">
          <h1
            className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] ${exposureTrial.className}`}
          >
            Find what matters, trace why it happened
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Understand context, trace decisions, know who owns what—with sources
            you can verify.
          </p>
        </div>
      </div>

      {/* Semantic Search */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <FeatureShowcase
          title="Search by meaning, not keywords"
          description="Ask questions in natural language. Lightfast understands intent and finds relevant answers across your entire knowledge base."
          linkText="Learn about semantic search"
          linkHref="/docs/features/semantic-search"
        >
          <SemanticSearchVisual />
        </FeatureShowcase>
      </div>

      {/* Ownership */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <FeatureShowcase
          title="Know who owns what"
          description="Track ownership across codebases, features, and areas of expertise. Find the right person with context on any topic."
          linkText="Learn about ownership tracking"
          linkHref="/docs/features/ownership"
          reverse
        >
          <OwnershipVisual />
        </FeatureShowcase>
      </div>

      {/* Decisions */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <FeatureShowcase
          title="Capture decisions as they happen"
          description="Automatically extract key moments from discussions, PRs, and meetings. Never lose the context behind important choices."
          linkText="Learn about decision tracking"
          linkHref="/docs/features/decisions"
        >
          <NeuralMemoryVisual />
        </FeatureShowcase>
      </div>

      {/* Citations */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <FeatureShowcase
          title="Every answer shows its source"
          description="Get synthesized answers with inline citations. Verify any claim by clicking through to the original source."
          linkText="Learn about citations"
          linkHref="/docs/features/citations"
          reverse
        >
          <CitationsVisual />
        </FeatureShowcase>
      </div>

      {/* What We Remember Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <h2
          className={`text-2xl md:text-3xl font-light mb-4 ${exposureTrial.className}`}
        >
          What we remember
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {memoryTypes.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-card border border-transparent rounded-xs p-8"
              >
                <div className="mb-22">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-base font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explore More Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <h4 className="text-lg font-medium text-muted-foreground">
          Explore more
        </h4>
        <ul className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {relatedPages.map((page) => (
            <li key={page.href} className="flex flex-col gap-3">
              <Link
                href={page.href}
                className={`text-xl font-light hover:underline ${exposureTrial.className}`}
              >
                {page.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {page.description}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto w-full px-4">
        <div className="bg-accent/40 border border-border/40 rounded-xs py-24 px-8">
          <div className="flex w-full flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-start">
            <div className="max-w-[600px]">
              <h2
                className={`text-xl md:text-2xl font-light ${exposureTrial.className}`}
              >
                Ready to give your team a memory layer?
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/early-access">Join Early Access</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="rounded-full"
              >
                <Link href="/docs/get-started/overview">View API Docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
