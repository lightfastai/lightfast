import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";
import { UseCaseGrid } from "~/components/use-case-grid";
import { agentBuildersUseCases } from "./data";

export const metadata: Metadata = createMetadata({
  title: "Lightfast for Agent Builders – Team Memory for AI Agents",
  description:
    "Your agents need context. Lightfast provides a shared memory substrate with 4 simple API routes and MCP tools. Answers with citations, not hallucinations.",
  openGraph: {
    title: "Lightfast for Agent Builders",
    description:
      "Give your AI agents team memory. 4 API routes. MCP tools. Answers with sources. No more brittle RAG hacks.",
    url: "https://lightfast.ai/use-cases/agent-builders",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/use-cases/agent-builders",
  },
});

export default function AgentBuildersPage() {
  return (
    <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section - centered content */}
      <div className="max-w-7xl mx-auto grid grid-cols-12">
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
          <section className="flex w-full flex-col items-center text-center">
            {/* Heading */}
            <h1
              className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] px-4 text-balance ${exposureTrial.className}`}
            >
              Agent Builders
            </h1>

            {/* Description */}
            <div className="mt-4 px-4 w-full">
              <p className="text-base text-muted-foreground whitespace-nowrap md:whitespace-normal lg:whitespace-nowrap">
                Give your AI agents team memory. Answers with sources, not hallucinations.
              </p>
            </div>

            {/* CTA - centered */}
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
                <span>Learn more about Lightfast</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Use Cases Grid */}
      <div className="max-w-7xl mx-auto w-full px-4">
        <UseCaseGrid items={agentBuildersUseCases} />
      </div>
    </div>
  );
}
