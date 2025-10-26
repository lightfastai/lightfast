import type { Metadata } from "next";
import type { IntegrationIcons } from "@repo/ui/integration-icons";
import { exposureTrial } from "~/lib/fonts";

export const metadata: Metadata = {
  title: "MCP Servers - Lightfast",
  description:
    "Explore the Model Context Protocol servers that power Lightfast's deep integrations.",
  openGraph: {
    title: "MCP Servers - Lightfast",
    description:
      "Explore the Model Context Protocol servers that power Lightfast's deep integrations.",
    url: "https://lightfast.ai/features/mcp",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "Lightfast MCP Servers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MCP Servers - Lightfast",
    description:
      "Explore the Model Context Protocol servers that power Lightfast's deep integrations.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/features/mcp",
  },
};

interface MCPServer {
  name: string;
  slug: keyof typeof IntegrationIcons;
  description: string;
  capabilities: string[];
  status: "connected" | "coming-soon";
}

const mcpServers: MCPServer[] = [
  {
    name: "GitHub",
    slug: "github",
    description:
      "Deep code and repository understanding with issue correlation",
    capabilities: ["Repository access", "Issue tracking", "PR management"],
    status: "connected",
  },
  {
    name: "Notion",
    slug: "notion",
    description: "Knowledge base and documentation semantic search",
    capabilities: ["Page search", "Content retrieval", "Workspace sync"],
    status: "coming-soon",
  },
  {
    name: "Linear",
    slug: "linear",
    description: "Project management with intelligent issue correlation",
    capabilities: ["Issue management", "Project tracking", "Team workflows"],
    status: "coming-soon",
  },
  {
    name: "Slack",
    slug: "slack",
    description: "Team communication with context-aware notifications",
    capabilities: ["Channel access", "Direct messaging", "Thread context"],
    status: "coming-soon",
  },
  {
    name: "Gmail",
    slug: "gmail",
    description: "Email management and intelligent inbox organization",
    capabilities: ["Email search", "Send/receive", "Label management"],
    status: "coming-soon",
  },
  {
    name: "Google Docs",
    slug: "googledocs",
    description: "Document collaboration with semantic understanding",
    capabilities: ["Doc search", "Content editing", "Comment management"],
    status: "coming-soon",
  },
  {
    name: "Google Sheets",
    slug: "googlesheets",
    description: "Spreadsheet analysis and data manipulation",
    capabilities: ["Data access", "Formula execution", "Chart generation"],
    status: "coming-soon",
  },
  {
    name: "PostHog",
    slug: "posthog",
    description: "Analytics correlation with deployments and errors",
    capabilities: ["Event tracking", "User analytics", "Feature flags"],
    status: "coming-soon",
  },
  {
    name: "Sentry",
    slug: "sentry",
    description: "Error tracking with automated debugging context",
    capabilities: ["Error monitoring", "Issue tracking", "Performance data"],
    status: "coming-soon",
  },
  {
    name: "Vercel",
    slug: "vercel",
    description: "Deployment orchestration and preview management",
    capabilities: ["Deploy tracking", "Preview URLs", "Environment vars"],
    status: "coming-soon",
  },
  {
    name: "Discord",
    slug: "discord",
    description: "Community engagement and bot interactions",
    capabilities: ["Server access", "Channel management", "Message history"],
    status: "coming-soon",
  },
  {
    name: "Airtable",
    slug: "airtable",
    description: "Database management with relational understanding",
    capabilities: ["Base access", "Record management", "View queries"],
    status: "coming-soon",
  },
  {
    name: "Datadog",
    slug: "datadog",
    description: "Infrastructure monitoring and log analysis",
    capabilities: ["Metrics access", "Log search", "Alert search"],
    status: "coming-soon",
  },
];

export default function MCPPage() {
  return (
    <>
      {/* Header Section */}
      <div className="pb-16">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1
              className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
            >
              Model Context Protocol Servers
            </h1>
            <p className="text-md text-muted-foreground leading-relaxed max-w-2xl">
              Lightfast uses MCP servers to enable deep, semantic integrations
              across your entire startup stack. Each server provides rich
              context and capabilities for intelligent orchestration.
            </p>
          </div>
        </div>
      </div>

      {/* MCP Table Section */}
      <div className="pb-16">
        <div className="border border-border rounded-sm overflow-hidden bg-card">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-muted/30 border-b border-border">
            <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Server
            </div>
            <div className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </div>
            <div className="col-span-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Capabilities
            </div>
            <div className="col-span-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
              Status
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {mcpServers.map((server) => {
              return (
                <div
                  key={server.slug}
                  className="grid grid-cols-12 gap-4 px-6 py-5 hover:bg-muted/20 transition-colors"
                >
                  {/* Server Name */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-medium text-foreground">
                      {server.name}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="col-span-4 flex items-center">
                    <p className="text-sm text-muted-foreground">
                      {server.description}
                    </p>
                  </div>

                  {/* Capabilities */}
                  <div className="col-span-5 flex items-center">
                    <div className="flex flex-wrap gap-2">
                      {server.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="inline-flex items-center px-2 py-1 rounded-sm text-xs font-mono bg-muted text-muted-foreground border border-border"
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex items-center justify-end">
                    {server.status === "connected" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 whitespace-nowrap">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="py-16">
        <div className="bg-card border border-border rounded-sm p-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              What are MCP Servers?
            </h3>
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              Model Context Protocol (MCP) is an open standard that enables AI
              models to securely access data and tools through standardized
              server implementations. Unlike traditional API integrations, MCP
              servers provide rich semantic context, allowing Lightfast to
              understand relationships between your codebase, business content,
              and tool ecosystems. This deep integration enables intelligent
              orchestration across your entire startup stack.
            </p>
            <div className="pt-4">
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
              >
                Learn more about MCP
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Request New MCP Section */}
      <div className="py-16">
        <div className="bg-muted/30 border-l-4 border-foreground rounded-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Missing an integration?
              </h3>
              <p className="text-sm text-muted-foreground">
                Request new MCP servers on GitHub
              </p>
            </div>
            <a
              href="https://github.com/lightfastai/lightfast/issues/new?labels=integration-request&template=mcp-request.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-border bg-background hover:bg-muted/50 text-foreground font-medium text-sm transition-colors whitespace-nowrap"
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              Request Integration
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
