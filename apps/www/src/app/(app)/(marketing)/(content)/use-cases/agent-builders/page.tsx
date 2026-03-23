import { Button } from "@repo/ui/components/ui/button";
import { createMetadata } from "@vendor/seo/metadata";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { UseCaseGrid } from "~/app/(app)/_components/use-case-grid";
import { agentBuildersUseCases } from "./data";

export const metadata: Metadata = createMetadata({
  title: "Lightfast for Agent Builders – Build the Superintelligence Layer",
  description:
    "Give your agents a single system to observe, reason, and act across every tool. REST API, MCP tools, and webhooks — integrate in minutes.",
  openGraph: {
    title: "Lightfast for Agent Builders",
    description:
      "Give your agents a single system to observe, reason, and act across every tool. REST API, MCP tools, and webhooks.",
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
      <div className="mx-auto grid max-w-7xl grid-cols-12">
        <div className="col-span-12 md:col-span-10 md:col-start-2 lg:col-span-10 lg:col-start-2">
          <section className="flex w-full flex-col items-center text-center">
            {/* Heading */}
            <h1 className="text-balance px-4 font-light font-pp text-2xl leading-[1.1] tracking-[-0.02em] sm:text-3xl md:text-4xl">
              Agent Builders
            </h1>

            {/* Description */}
            <div className="mt-4 w-full px-4">
              <p className="whitespace-nowrap text-base text-muted-foreground md:whitespace-normal lg:whitespace-nowrap">
                Build AI systems that predict, prevent, and optimize across your
                entire stack.
              </p>
            </div>

            {/* CTA - centered */}
            <div className="mt-8 flex flex-col justify-center gap-8 sm:flex-row">
              <Button asChild className="rounded-full" size="lg">
                <MicrofrontendLink
                  className="group"
                  href="/early-access"
                  prefetch={true}
                >
                  <span>Join Early Access</span>
                </MicrofrontendLink>
              </Button>
              <MicrofrontendLink
                className="group inline-flex items-center justify-center font-medium text-sm transition-colors hover:text-foreground/80"
                href="/docs/get-started/overview"
              >
                <span>Learn more about Lightfast</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </MicrofrontendLink>
            </div>
          </section>
        </div>
      </div>

      {/* Use Cases Grid */}
      <div className="mx-auto w-full max-w-7xl px-4">
        <UseCaseGrid items={agentBuildersUseCases} />
      </div>
    </div>
  );
}
