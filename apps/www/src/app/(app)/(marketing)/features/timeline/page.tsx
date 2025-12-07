import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, History, CalendarDays, GitCommit } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";

export const metadata: Metadata = createMetadata({
  title: "Timeline – Track Decisions Over Time | Lightfast",
  description:
    "See how things evolved. Track decisions, changes, and context over time. Answer 'what was the status last week?' with confidence.",
  openGraph: {
    title: "Timeline – Track Decisions Over Time",
    description:
      "See how things evolved. Track decisions, changes, and context over time.",
    url: "https://lightfast.ai/features/timeline",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/features/timeline",
  },
});

const capabilities = [
  {
    icon: History,
    title: "Temporal Queries",
    description:
      "Ask 'What was the status last week?' or 'Show me deployments from Q3'. Get answers with full historical accuracy.",
  },
  {
    icon: GitCommit,
    title: "Change Tracking",
    description:
      "See what changed, when it changed, and who changed it. Track the evolution of any entity over time.",
  },
  {
    icon: CalendarDays,
    title: "Auto-Summaries",
    description:
      "Daily and weekly summaries of team activity. Know what happened without reading every message.",
  },
  {
    icon: Clock,
    title: "Decision Points",
    description:
      "Capture when decisions were made and the context around them. Never wonder 'why did we do this?'",
  },
];

const examples = [
  {
    question: "What decisions were made about the auth system?",
    context: "Shows all authentication-related decisions with dates and participants",
  },
  {
    question: "Who was working on payments last month?",
    context: "Lists team members with payment-related commits, issues, and discussions",
  },
  {
    question: "What changed in the API since last release?",
    context: "Aggregates PRs, issues, and docs changes between release dates",
  },
];

export default function TimelinePage() {
  // TODO content guide:
  // - Hero: “See how things evolved” + subtext on decisions/changes over time; CTA to explore timeline; plan availability.
  // - 3-step “How it works”: Pick entity (service/repo/feature/incident/person) → Stitch events (PRs, tickets, incidents, chats) → Skim rationale with citations/owners.
  // - Pillars: Decision history with sources; Ownership/dependency graph (1–2 hops); Incident/postmortem view; Onboarding summaries.
  // - Example queries: “Why did we switch databases?” “Who touched auth last week?” “What changed between releases?”
  // - Trust: every event links to original source; rationale constrained to short hops; no opaque summaries.
  return (
    <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-12">
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
          <section className="flex w-full flex-col items-center text-center">
            {/* Small label */}
            <div className="mb-8 opacity-80">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Timeline
              </p>
            </div>

            {/* Heading */}
            <h1
              className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
            >
              See how things evolved
            </h1>

            {/* Description */}
            <div className="mt-4 px-4 w-full max-w-2xl">
              <p className="text-base text-muted-foreground">
                Track decisions, changes, and context over time. Know what
                happened, when it happened, and why.
              </p>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col justify-center gap-8 sm:flex-row">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/early-access" className="group">
                  <span>Join Early Access</span>
                </Link>
              </Button>
              <Link
                href="/docs/get-started/overview"
                className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
              >
                <span>Learn more</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="max-w-5xl mx-auto w-full px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {capabilities.map((capability) => (
            <div
              key={capability.title}
              className="flex flex-col gap-4 p-6 border border-border rounded-sm"
            >
              <capability.icon className="h-6 w-6 text-muted-foreground" />
              <h3 className="text-lg font-medium">{capability.title}</h3>
              <p className="text-sm text-muted-foreground">
                {capability.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Example Queries Section */}
      <div className="max-w-5xl mx-auto w-full px-4">
        <div className="border border-border rounded-sm p-8 md:p-12">
          <h2
            className={`text-xl md:text-2xl font-light mb-6 ${exposureTrial.className}`}
          >
            Questions you can answer
          </h2>
          <div className="space-y-6">
            {examples.map((example) => (
              <div
                key={example.question}
                className="py-4 border-b border-border last:border-b-0"
              >
                <p className="text-base font-medium mb-2">
                  &ldquo;{example.question}&rdquo;
                </p>
                <p className="text-sm text-muted-foreground">
                  {example.context}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
