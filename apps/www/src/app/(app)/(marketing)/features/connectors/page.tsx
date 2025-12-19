import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  MessageSquare,
  FileText,
  Layers,
  Search,
  RefreshCw,
  Users,
  Zap,
  Link2,
  Shield,
} from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";
import { exposureTrial } from "~/lib/fonts";
import { IntegrationShowcase } from "~/components/integration-showcase";
import { ConnectorHeroVisual } from "~/components/landing/connector-hero-visual";

export const metadata: Metadata = createMetadata({
  title: "Connectors – Integrate Your Tools | Lightfast",
  description:
    "Connect GitHub, Linear, Notion, Slack, and more. Pull in PRs, issues, docs, and discussions. One source of truth for your team.",
  openGraph: {
    title: "Connectors – Integrate Your Tools",
    description:
      "Connect GitHub, Linear, Notion, Slack, and more. Pull in PRs, issues, docs, and discussions.",
    url: "https://lightfast.ai/features/connectors",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/features/connectors",
  },
});

const connectors = [
  {
    icon: GitBranch,
    name: "GitHub",
    description:
      "Pull requests, issues, commits, and discussions. Track code changes and who made them.",
    status: "Available",
  },
  {
    icon: Layers,
    name: "Linear",
    description:
      "Issues, projects, and cycles. Keep track of what's planned, in progress, and done.",
    status: "Available",
  },
  {
    icon: FileText,
    name: "Notion",
    description:
      "Pages, databases, and wikis. Search your team's documentation and knowledge base.",
    status: "Coming soon",
  },
  {
    icon: MessageSquare,
    name: "Slack",
    description:
      "Messages, threads, and channels. Capture decisions and context from conversations.",
    status: "Coming soon",
  },
];

const benefits = [
  {
    icon: Search,
    title: "One search, all sources",
    description:
      "Search across all your connected tools at once. No more switching between apps to find what you need.",
  },
  {
    icon: RefreshCw,
    title: "Automatic sync",
    description:
      "Changes sync in real-time. New PRs, issues, and messages are indexed as they happen.",
  },
  {
    icon: Users,
    title: "Identity correlation",
    description:
      "Link the same person across platforms. john@company.com on GitHub is John Smith on Linear.",
  },
  {
    icon: Zap,
    title: "Instant answers",
    description:
      "Get answers from your connected tools without spending hours on research.",
  },
  {
    icon: Link2,
    title: "Track dependencies",
    description:
      "See what depends on what. Understand relationships across your codebase and documentation.",
  },
  {
    icon: Shield,
    title: "Privacy by default",
    description:
      "Your data stays yours. Complete tenant isolation with enterprise-grade security.",
  },
];

const connectorFaqs = [
  {
    question: "How many connectors can I use?",
    answer:
      "Connectors count as sources in your plan. Starter includes 2 sources, Team includes 5 sources, and Business includes unlimited sources. A source is an entire workspace or organization—a GitHub org with 100 repos counts as one source. Additional sources are $10/month each on the Team plan.",
  },
  {
    question: "Who can enable or disable connectors?",
    answer:
      "Workspace owners and admins can manage connector availability in Settings → Connectors. Team members can connect their own accounts once a connector is enabled.",
  },
  {
    question: "Can I remove a connector from my workspace?",
    answer:
      "Yes. Go to Settings → Connectors, select the connector you want to remove, and click Disconnect. All indexed data from that connector will be removed from your workspace, and the source will no longer count toward your plan limit.",
  },
  {
    question: "Will more connectors be added?",
    answer:
      "Yes, we're actively building new connectors. Notion and Slack are coming soon. Request a connector through our feedback form and we'll prioritize based on demand.",
  },
  {
    question: "What data types do connectors support?",
    answer:
      "Each connector indexes different content types. GitHub includes code, PRs, issues, and discussions. Linear includes issues, projects, and comments. We extract text, metadata, and relationships from each source.",
  },
  {
    question: "How is connector data kept secure?",
    answer:
      "Each workspace has isolated storage—separate database schemas, vector namespaces, and encryption keys. We use OAuth for authentication and never store your source credentials. You can revoke access anytime.",
  },
];

export default function ConnectorsPage() {
  return (
    <div className="mt-6 flex w-full flex-col gap-32 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section — Split */}
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8 items-center px-4 min-h-[500px] lg:min-h-[600px]">
        {/* Text Column */}
        <div className="col-span-12 lg:col-span-5">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Connectors
            </p>
          </div>
          <h1
            className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] ${exposureTrial.className}`}
          >
            Connect your tools
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Pull in knowledge from where your team already works. GitHub,
            Linear, Notion, Slack, and more—all searchable in one place.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/early-access">Join Early Access</Link>
            </Button>
            <Link
              href="/docs/get-started/overview"
              className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
            >
              <span>View all connectors</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Media Column */}
        <div className="col-span-12 lg:col-span-7">
          <ConnectorHeroVisual />
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <h2
          className={`text-2xl md:text-3xl font-light mb-4 ${exposureTrial.className}`}
        >
          Connectors make Lightfast
          <br />
          even more useful
        </h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="bg-card border border-transparent rounded-xs p-8"
              >
                <div className="mb-22">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-base font-medium">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Connectors Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <h2
          className={`text-2xl md:text-3xl font-light mb-10 ${exposureTrial.className}`}
        >
          Available connectors
        </h2>
        <IntegrationShowcase />
      </div>

      {/* FAQ Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left side - FAQ label */}
          <div className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              FAQs
            </span>
          </div>

          {/* Right side - FAQ content */}
          <div className="md:col-span-10 md:col-start-3">
            {/* Header with CTA */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8 pb-8 border-b border-border">
              <div className="space-y-1">
                <p className="text-xl text-muted-foreground">Find answers.</p>
              </div>

              <div className="mt-6 lg:mt-0 lg:text-right">
                <p className="text-sm text-muted-foreground mb-2">
                  Any more questions?
                </p>
                <Link
                  href="/docs/get-started/overview"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors group"
                >
                  View documentation
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* FAQ Accordion */}
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue="item-0"
            >
              {connectorFaqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-b border-border last:border-b-0"
                >
                  <AccordionTrigger
                    className={cn(
                      "flex justify-between items-center w-full py-6 text-left",
                      "hover:no-underline group",
                    )}
                  >
                    <span className="text-base font-medium text-foreground pr-4">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pr-12">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto w-full px-4">
        <div className="bg-accent/40 border border-border/40 rounded-xs py-24 px-8">
          <div className="flex w-full flex-col items-center justify-between gap-8 text-center lg:flex-row lg:text-start">
            <div className="max-w-[600px]">
              <h2
                className={`text-xl md:text-2xl font-light ${exposureTrial.className}`}
              >
                Ready to connect your tools?
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
                <Link href="/docs/get-started/overview">
                  View Documentation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
