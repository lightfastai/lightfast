import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createMetadata } from "@vendor/seo/metadata";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";
import { AgentHeroVisual } from "~/components/landing/agent-hero-visual";
import { McpAgentVisual } from "~/components/landing/mcp-agent-visual";
import { VisualShowcase } from "~/components/visual-showcase";

export const metadata: Metadata = createMetadata({
  title: "For Agents – AI Agent Integration | Lightfast",
  description:
    "Give your AI agents access to memory layer. MCP tools and REST API for seamless integration. Same powerful search for humans and agents.",
  openGraph: {
    title: "For Agents – AI Agent Integration",
    description:
      "Give your AI agents access to memory layer. MCP tools and REST API for seamless integration.",
    url: "https://lightfast.ai/features/agents",
    type: "website",
  },
  alternates: {
    canonical: "https://lightfast.ai/features/agents",
  },
});

const apiRoutes = [
  {
    method: "POST",
    path: "/v1/search",
    description:
      "Search and rank results with optional rationale and highlights",
  },
  {
    method: "POST",
    path: "/v1/contents",
    description: "Get full documents, metadata, and relationships",
  },
  {
    method: "POST",
    path: "/v1/similar",
    description: "Find related content based on meaning",
  },
  {
    method: "POST",
    path: "/v1/answer",
    description: "Get synthesized answers with citations (supports streaming)",
  },
];

const relatedPages = [
  {
    title: "For Software Teams",
    href: "/features/memory",
    description: "Search everything your team knows. Find answers instantly.",
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

export default function AgentsPage() {
  return (
    <div className="mt-6 flex w-full flex-col gap-20 overflow-x-clip pb-32 md:px-10">
      {/* Hero Section — Split */}
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8 items-center px-4 min-h-[500px] lg:min-h-[600px]">
        {/* Text Column */}
        <div className="col-span-12 lg:col-span-5">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              For Agents
            </p>
          </div>
          <h1
            className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] ${exposureTrial.className}`}
          >
            Give your agents a memory layer
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Any agent can ask &ldquo;who/what/why/depends&rdquo; and get
            accurate answers with sources—across your entire company&apos;s
            ecosystem.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/early-access">Join Early Access</Link>
            </Button>
            <Link
              href="/docs/get-started/overview"
              className="group inline-flex items-center justify-center text-sm font-medium transition-colors hover:text-foreground/80"
            >
              <span>View API docs</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Media Column */}
        <div className="col-span-12 lg:col-span-7">
          <AgentHeroVisual />
        </div>
      </div>

      {/* MCP Agent Visual */}
      <div className="max-w-6xl px-4 mx-auto w-full">
        <VisualShowcase>
          <McpAgentVisual />
        </VisualShowcase>
      </div>

      {/* API Routes Section */}
      <div className="max-w-6xl mx-auto w-full px-4">
        <div className="border border-border rounded-xs p-8 md:p-12">
          <h2
            className={`text-xl md:text-2xl font-light mb-6 ${exposureTrial.className}`}
          >
            Four routes. That&apos;s it.
          </h2>
          <div className="space-y-4">
            {apiRoutes.map((route) => (
              <div
                key={route.path}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded-xs">
                    {route.method}
                  </span>
                  <code className="text-sm font-mono">{route.path}</code>
                </div>
                <p className="text-sm text-muted-foreground sm:ml-auto">
                  {route.description}
                </p>
              </div>
            ))}
          </div>
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
                Ready to give your agents memory?
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
