import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import { WaitlistForm } from "../_components/(waitlist)/waitlist-form";

export const metadata: Metadata = {
  title: "Integrations - Lightfast",
  description:
    "Deep integrations that understand context, not just trigger-action. Lightfast provides semantic understanding across your entire startup stack.",
  openGraph: {
    title: "Integrations - Lightfast",
    description:
      "Deep integrations that understand context, not just trigger-action. Lightfast provides semantic understanding across your entire startup stack.",
    url: "https://lightfast.ai/integrations",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "Lightfast Integrations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Integrations - Lightfast",
    description:
      "Deep integrations that understand context, not just trigger-action. Lightfast provides semantic understanding across your entire startup stack.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/integrations",
  },
};

interface Integration {
  name: string;
  description: string;
  status: "live" | "coming-soon";
}

interface IntegrationCategory {
  title: string;
  description: string;
  integrations: Integration[];
}

const integrationCategories: IntegrationCategory[] = [
  {
    title: "Project Management",
    description: "Semantic understanding of issues, milestones, dependencies",
    integrations: [
      {
        name: "Linear",
        description:
          "Intelligent issue correlation with GitHub PRs, automated sprint planning, and context-aware milestone tracking",
        status: "coming-soon",
      },
      {
        name: "Jira",
        description:
          "Deep workflow understanding, epic-to-task relationships, and cross-team dependency mapping",
        status: "coming-soon",
      },
    ],
  },
  {
    title: "Business Context Aggregation",
    description: "Understand company knowledge graph",
    integrations: [
      {
        name: "Google Drive",
        description:
          "Semantic search across documents, intelligent file organization, and automatic context retrieval",
        status: "coming-soon",
      },
      {
        name: "Confluence",
        description:
          "Wiki-style knowledge base understanding, page relationship mapping, and version-aware content sync",
        status: "coming-soon",
      },
      {
        name: "Notion",
        description:
          "Database-native understanding, cross-workspace knowledge graph, and intelligent content correlation",
        status: "coming-soon",
      },
    ],
  },
  {
    title: "Dev Workflows",
    description: "Correlate deployments → errors → analytics → code",
    integrations: [
      {
        name: "GitHub",
        description:
          "Deep code understanding, commit-to-deployment tracking, and automated PR workflows with full context",
        status: "live",
      },
      {
        name: "Vercel",
        description:
          "Deployment correlation with code changes, preview environment management, and rollback intelligence",
        status: "coming-soon",
      },
      {
        name: "PostHog",
        description:
          "Analytics correlation with deployments, feature flag impact analysis, and user behavior insights",
        status: "coming-soon",
      },
      {
        name: "Sentry",
        description:
          "Error tracking with automated debugging context, deployment correlation, and intelligent issue grouping",
        status: "coming-soon",
      },
      {
        name: "PlanetScale",
        description:
          "Database schema understanding, migration tracking, and query performance correlation",
        status: "coming-soon",
      },
    ],
  },
  {
    title: "Communication",
    description: "Context-aware notifications and responses",
    integrations: [
      {
        name: "Slack",
        description:
          "Intelligent thread understanding, automated context sharing, and team notification orchestration",
        status: "coming-soon",
      },
      {
        name: "Discord",
        description:
          "Community engagement intelligence, server-wide context awareness, and automated bot interactions",
        status: "coming-soon",
      },
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <>
      {/* Header Section */}
      <div className="pb-20">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1
              className={`text-5xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
            >
              Deep Integrations, Not Surface-Level
            </h1>
            <p className="text-md text-muted-foreground leading-relaxed max-w-2xl">
              Unlike traditional automation tools that just connect APIs,
              Lightfast provides semantic understanding across your entire
              startup stack. Our integrations understand context, correlate data
              across tools, and enable intelligent orchestration.
            </p>
          </div>
        </div>
      </div>

      {/* Philosophy Section */}
      <div className="pb-20">
        <div className="bg-card border border-border rounded-sm p-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                Beyond Trigger-Action
              </h2>
              <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Traditional integration platforms treat tools as isolated
                endpoints. Lightfast builds a unified knowledge graph across
                your codebase, business content, and tool ecosystems—enabling
                true contextual understanding.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Semantic Understanding
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Correlate GitHub commits with Linear issues, PostHog metrics,
                  and Sentry errors—all in one context
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Deep Context Graph
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unified understanding of codebase, business content, and tool
                  state for intelligent orchestration
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    AI-Native Workflows
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Describe intent in natural language—Lightfast orchestrates
                  complex multi-step workflows automatically
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Categories Grid */}
      <div className="pb-20">
        <div className="space-y-12">
          {integrationCategories.map((category) => (
            <div key={category.title} className="space-y-6">
              {/* Category Header */}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  {category.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </div>

              {/* Integration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.integrations.map((integration) => (
                  <div
                    key={integration.name}
                    className="bg-card border border-border rounded-sm p-6 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-foreground">
                        {integration.name}
                      </h3>
                      {integration.status === "live" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 whitespace-nowrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-medium bg-muted text-muted-foreground border border-border whitespace-nowrap">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {integration.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Tools Section */}
      <div className="pb-20">
        <div className="bg-muted/30 border-l-4 border-foreground rounded-sm p-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                Code Tool Native
              </h2>
              <p className="text-sm text-muted-foreground">
                Orchestrator can spawn code agents for execution
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  Claude Code
                </h3>
                <p className="text-xs text-muted-foreground">
                  Deep integration with Claude's official CLI for seamless code
                  execution and orchestration
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  Codex
                </h3>
                <p className="text-xs text-muted-foreground">
                  Spawn Codex agents for specialized development workflows and
                  automated coding tasks
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-foreground">
                  Cursor
                </h3>
                <p className="text-xs text-muted-foreground">
                  Integrate with Cursor for AI-powered code editing and
                  collaborative development
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="pb-20">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Real-World Orchestration
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              See how Lightfast's deep integrations enable complex workflows
              that would be impossible with traditional automation tools
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card border border-border rounded-sm p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-sm bg-foreground/10 flex items-center justify-center">
                    <span className="text-xs font-mono font-semibold text-foreground">
                      1
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      "Why did signups drop 20% last week?"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → Correlates PostHog analytics + Sentry errors + GitHub
                      deployments to identify the exact commit that introduced a
                      checkout bug
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-sm p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-sm bg-foreground/10 flex items-center justify-center">
                    <span className="text-xs font-mono font-semibold text-foreground">
                      2
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      "Fix the auth bug from Sentry"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → Spawns Claude Code agent with full error context, debugs
                      the issue, creates a PR with tests, and links to the
                      original Sentry issue
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-sm p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1 h-6 w-6 rounded-sm bg-foreground/10 flex items-center justify-center">
                    <span className="text-xs font-mono font-semibold text-foreground">
                      3
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      "What's blocking the auth milestone?"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → Pulls Linear issues + GitHub PR status + Slack
                      discussions to give complete context on blockers and
                      dependencies
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="bg-card border border-border rounded-sm p-12">
          <div className="space-y-8">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <h2
                className={`text-4xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
              >
                Make your 3-person team feel like 50
              </h2>
              <p className="text-md text-muted-foreground leading-relaxed">
                Join the waitlist for early access to Lightfast. Orchestrate
                your entire startup stack with deep, semantic integrations.
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>

      {/* Request Integration Section */}
      <div className="pb-20">
        <div className="bg-muted/30 border-l-4 border-foreground rounded-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                Missing an integration?
              </h3>
              <p className="text-sm text-muted-foreground">
                Request new integrations on GitHub or explore our MCP servers
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/features/mcp"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-border bg-background hover:bg-muted/50 text-foreground font-medium text-sm transition-colors whitespace-nowrap"
              >
                View MCP Servers
              </a>
              <a
                href="https://github.com/lightfastai/lightfast/issues/new?labels=integration-request&template=integration-request.md"
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
      </div>
    </>
  );
}
