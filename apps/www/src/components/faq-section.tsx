import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Dynamically imported so the Radix accordion JS ships in a separate lazy chunk.
// The FAQ is below the fold — no need to block the critical path with
// @radix-ui/react-accordion + its shared primitives on initial load.
const FaqAccordion = dynamic(
  () => import("./faq-accordion").then((m) => ({ default: m.FaqAccordion })),
);

export const faqs = [
  {
    question: "What is Lightfast?",
    answer:
      "Lightfast is the operating layer between your agents and apps. It observes what's happening across your tools, remembers what happened, and gives agents and people a single system to reason and act through — without knowing which tools exist or how they work.",
  },
  {
    question: "What does 'operating layer' mean?",
    answer:
      "Think of Lightfast like an OS for your tool stack. Instead of agents making individual API calls to GitHub, Linear, Sentry, and Slack, they operate through Lightfast — express intent, get context, take action. One integration point for every tool, every team, every workflow.",
  },
  {
    question: "What tools do you integrate with?",
    answer:
      "Today we support GitHub (pushes, PRs, issues, reviews), Vercel (deployments, project activity), Sentry (errors, issues, alerts), and Linear (issues, comments, projects, cycles). Slack, Notion, Confluence, and PagerDuty are coming soon. Each integration ingests events automatically and continuously.",
  },
  {
    question: "How does the event system work?",
    answer:
      "Lightfast ingests structured events from your connected tools in real time. Every push, pull request, deployment, error, and issue becomes a normalized event you can subscribe to, filter, and act on. Events are immutable and causally ordered — facts your agents and workflows can rely on.",
  },
  {
    question: "How do agents and AI assistants use Lightfast?",
    answer:
      "Lightfast provides a REST API, TypeScript SDK, and MCP (Model Context Protocol) tools that any agent can use. Agents can search your workspace, get cited answers, find related context, and express intent that Lightfast resolves to the right tool and action. Same primitives for agents and people.",
  },
  {
    question: "What's coming after events?",
    answer:
      "Next is Memory — semantic search and cited answers across your entire tool stack. Everything from the event system gets indexed, connected, and made searchable by meaning. After that, the full Operating Layer: agents express what they want in natural language, and Lightfast resolves it to the right tool, enforces your rules, and tracks everything.",
  },
  {
    question: "Is our data secure and private?",
    answer:
      "Every workspace is completely isolated — separate database schemas, separate vector namespaces, separate storage. Your data never mixes with others. We use industry-standard encryption at rest and in transit, and we never train on your data. You can delete your data anytime.",
  },
  {
    question: "How quickly can we get started?",
    answer:
      "Minutes. Connect your first source, and events start flowing immediately. Our TypeScript SDK installs with a single command, and MCP tools let AI assistants connect directly. No complex setup, no schema mapping, no custom pipelines.",
  },
  {
    question: "How does pricing work?",
    answer:
      "We offer a free Starter plan for up to 3 users with 2 sources. Team plan is $20/user/month with full event access and semantic search. Business plan includes unlimited sources and advanced features. Check our pricing page for full details.",
  },
];

export function FAQSection() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-16">
        {/* Left: Badge */}
        <div>
          <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground">
            FAQ
          </span>
        </div>

        {/* Right: FAQ content - spans 2 columns */}
        <div className="lg:col-span-2">
          {/* Header with CTA */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8 pb-8 border-b border-border">
            <div className="space-y-1">
              <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                Learn how the operating layer works.
              </p>
            </div>

            <div className="mt-6 lg:mt-0 lg:text-right">
              <p className="text-sm text-muted-foreground mb-2">
                Ready to get started?
              </p>
              <Link
                href="/early-access"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors group"
              >
                Join early access
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* FAQ Accordion — client JS loaded lazily (below the fold) */}
          <FaqAccordion faqs={faqs} />
        </div>
      </div>
    </div>
  );
}
