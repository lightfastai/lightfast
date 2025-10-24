import type { Metadata } from "next";
import { exposureTrial } from "~/lib/fonts";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Use Cases - AI Orchestration for Technical Founders",
  description:
    "Discover how Lightfast helps technical founders scale their startups from 0 to $100M ARR. From product development to team unblocking, see real-world use cases of AI workflow orchestration.",
  keywords: [
    "AI workflow automation use cases",
    "technical founder tools",
    "startup orchestration platform",
    "dev workflow automation examples",
    "AI team collaboration",
    "product development automation",
    "startup scaling tools",
    "AI orchestration examples",
  ],
  openGraph: {
    title: "Use Cases - AI Orchestration for Technical Founders",
    description:
      "Discover how Lightfast helps technical founders scale their startups. See real-world use cases of AI workflow orchestration.",
    url: "https://lightfast.ai/use-cases",
    type: "website",
    images: [
      {
        url: "https://lightfast.ai/og.jpg",
        width: 1200,
        height: 630,
        alt: "AI Workflow Automation Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Use Cases - AI Orchestration for Technical Founders",
    description:
      "Discover how Lightfast helps technical founders scale their startups. See real-world use cases of AI workflow orchestration.",
    images: ["https://lightfast.ai/og.jpg"],
  },
  alternates: {
    canonical: "https://lightfast.ai/use-cases",
  },
};

export default function UseCasesPage() {
  return (
    <>
      {/* Header Section */}
      <div className="pb-32">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1
              className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
            >
              Make small teams feel like 50-person companies
            </h1>
            <p className="text-md text-muted-foreground leading-relaxed max-w-2xl">
              Lightfast orchestrates workflows across your entire startup stack.
              One conversation coordinates GitHub, Linear, PostHog, Sentry, and
              everything in between—unblocking your team and freeing engineers
              to build product.
            </p>
          </div>

          <div className="pt-4">
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">
              Built for Technical Founders with Small Teams (1-10 people)
            </p>
          </div>
        </div>
      </div>

      {/* Product Development Section */}
      <div className="pb-32">
        <div className="space-y-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
              Product Development
            </p>
            <h2 className="text-3xl font-base leading-tight text-foreground">
              Ship faster with orchestrated development workflows
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              From feature flags to production deployments, Lightfast
              coordinates your entire development stack in natural language.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Use Case 1 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "Deploy feature flags for premium tier"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Orchestrates GitHub + Vercel + LaunchDarkly to configure
                    feature flags, update code, and deploy to production
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "Fix the auth bug from Sentry"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Spawns Claude Code agent to debug the issue, implements fix,
                    runs tests, and creates PR with full context from Sentry
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "Set up Stripe billing with usage-based pricing"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Configures Stripe products and pricing, implements billing
                    code with webhooks, updates database schema, and deploys to
                    staging
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Unblocking Section */}
      <div className="pb-32">
        <div className="space-y-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
              Team Unblocking
            </p>
            <h2 className="text-3xl font-base leading-tight text-foreground">
              Unblock non-technical team from engineering dependencies
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              PMs and support can self-serve answers without interrupting
              engineering. Lightfast correlates context across tools to provide
              complete answers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Use Case 1 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    PM
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "What's blocking the auth milestone?"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Pulls context from Linear issues, GitHub PRs, and Slack
                    threads to identify blockers and dependencies
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    PM
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "Why did signups drop 20% last week?"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Correlates PostHog analytics, Sentry errors, and GitHub
                    deploys to identify the root cause with timeline
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Support
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "Escalate critical bugs"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Automatically creates Linear issues from Sentry errors with
                    full context and sends Slack notification to engineering
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Retrieval Section */}
      <div className="pb-32">
        <div className="space-y-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
              Context Retrieval
            </p>
            <h2 className="text-3xl font-base leading-tight text-foreground">
              Get complete answers in seconds, not hours
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              No more switching between tabs or asking engineers for updates.
              Lightfast's deep context graph knows your codebase and business
              content.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Use Case 1 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "What features are we shipping this week?"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Pulls from Linear milestones with GitHub PR status,
                    reviewer assignments, and deployment readiness
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "Show me all high-priority bugs assigned to backend"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Correlates Linear issues with Sentry error rates, affected
                    users, and code ownership
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                  "What's our churn rate trending?"
                </code>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Queries PostHog with business context, showing trends,
                    cohorts, and correlations with recent changes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Functional Workflows Section */}
      <div className="pb-32">
        <div className="space-y-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
              Cross-Functional Workflows
            </p>
            <h2 className="text-3xl font-base leading-tight text-foreground">
              Break down silos across sales, marketing, and operations
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Every team member gets AI-powered workflows tailored to their
              needs. No engineering bottleneck for data pulls or integrations.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Use Case 1 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Sales
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "Get all leads from last week with &gt;$10k ARR potential"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Combines CRM data with product usage analytics to identify
                    high-value leads and their engagement patterns
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 2 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Marketing
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "Create deployment announcement"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Pulls GitHub releases, generates changelog from commits, and
                    drafts social media posts with key features
                  </p>
                </div>
              </div>
            </div>

            {/* Use Case 3 */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Operations
                  </span>
                  <code className="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded inline-block">
                    "Generate weekly metrics report"
                  </code>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-1 shrink-0" />
                  <p className="text-sm">
                    Aggregates PostHog analytics, PlanetScale database metrics,
                    and creates formatted Notion doc with trends and insights
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Value Proposition Section */}
      <div className="pb-32">
        <div className="bg-card border border-border rounded-sm p-12">
          <div className="space-y-8 max-w-3xl">
            <div className="space-y-4">
              <h2
                className={`text-4xl font-light leading-tight tracking-[-0.5] text-foreground ${exposureTrial.className}`}
              >
                Stop spending 60% of your time on integration and data pulls
              </h2>
              <p className="text-md text-muted-foreground leading-relaxed">
                Lightfast's AI orchestration layer bridges the gap between
                founder intent and executed workflows. Deep context
                understanding across your codebase and tools means your entire
                team can move at startup velocity—without engineering
                bottlenecks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  Deep Integrations
                </h3>
                <p className="text-sm text-muted-foreground">
                  Not surface-level automations. Semantic understanding of
                  workflows across Linear, GitHub, PostHog, Sentry, and your
                  entire stack.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  Context-Aware
                </h3>
                <p className="text-sm text-muted-foreground">
                  Unified knowledge graph connecting codebase, business content,
                  and tool state. Every answer comes with full context.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground">
                  Team Velocity
                </h3>
                <p className="text-sm text-muted-foreground">
                  Non-technical team members can execute complex workflows.
                  Engineering focuses on building product, not answering
                  questions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
