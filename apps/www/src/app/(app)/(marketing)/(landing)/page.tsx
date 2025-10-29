import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import Link from "~/components/ui/link";
import { Button } from "@repo/ui/components/ui/button";
import { exposureTrial } from "~/lib/fonts";
import { ExaSearchVisual } from "~/components/landing/exa-search-visual";
import { IntegrationShowcase } from "~/components/landing/integration-showcase";
import { McpAgentVisual } from "~/components/landing/mcp-agent-visual";
import { NeuralMemoryVisual } from "~/components/landing/neural-memory-visual";

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <div className="section-gap-b py-16">
        <div className="space-y-12">
          <div className="space-y-3">
            <h1
              className={`text-4xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
            >
              Memory built for teams
            </h1>
            <p className="text-md text-muted-foreground leading-relaxed max-w-md">
              Search everything your team knows. Get answers with sources,
              instantly.
            </p>
          </div>

          <div className="max-w-xl">
            <WaitlistForm />
          </div>
        </div>
      </div>

      {/* How It Works Section - Grid Layout */}
      <div className="section-gap-b">
        <div className="grid grid-cols-1 border border-none bg-muted/40 p-6 rounded-sm lg:grid-cols-12 gap-16">
          {/* Left Column: Simple Description (5/12) */}
          <div className="lg:col-span-4 flex flex-col p-0">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                How It Works
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl text-foreground">
                Search by meaning, not keywords
              </h3>
            </div>
            <div className="flex-1 flex mt-6 lg:mt-0 lg:items-center">
              <div className="space-y-8 md:space-y-10 lg:-mt-8">
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Find what you need
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions naturally. Get answers from across your entire
                    organization instantly.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    See the source
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Every answer shows where it came from. Click through to the
                    original discussion, commit, or document.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Understand relationships
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    See who owns what, what depends on what, and why decisions
                    were made.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Engine Visual (7/12) */}
          <div className="lg:col-span-8 h-full">
            <ExaSearchVisual />
          </div>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="section-gap-b">
        <IntegrationShowcase />
      </div>

      {/* Built for Agents Section - Grid Layout */}
      <div className="section-gap-b">
        <div className="grid grid-cols-1 bg-accent/40 p-6 border border-none rounded-sm lg:grid-cols-12 gap-16">
          {/* Left Column: Description */}
          <div className="lg:col-span-4 flex flex-col p-0">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                For Agents
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl text-foreground">
                Built for autonomous workflows
              </h3>
            </div>
            <div className="flex-1 flex mt-6 lg:mt-0 lg:items-center">
              <div className="space-y-8 md:space-y-10 lg:-mt-8">
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    MCP tools ready
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Same four routes, available as MCP tools. Let your agents
                    search memory, find similar content, and synthesize
                    answers—all with citations.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Agent-native API
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Simple, composable tools that agents can use independently
                    or chain together for complex reasoning.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Always grounded
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Every tool returns citations. Agents can verify claims and
                    show their work to users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Agent Visual */}
          <div className="lg:col-span-8 h-full">
            <McpAgentVisual />
          </div>
        </div>
      </div>

      {/* Neural Memory Section - Grid Layout */}
      <div className="section-gap-b">
        <div className="grid grid-cols-1 bg-accent/40 p-6 border border-none rounded-sm lg:grid-cols-12 gap-16">
          {/* Left Column: Description */}
          <div className="lg:col-span-4 flex flex-col p-0">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                Neural Memory
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl text-foreground">
                Capture decisions as they happen
              </h3>
            </div>
            <div className="flex-1 flex mt-6 lg:mt-0 lg:items-center">
              <div className="space-y-8 md:space-y-10 lg:-mt-8">
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Automatic extraction
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Extract key decisions, incidents, and highlights from PRs,
                    issues, and discussions. No manual tagging required.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Context over time
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    See what was discussed, who was involved, and why decisions
                    were made. Never lose institutional knowledge.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Organized summaries
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Related observations cluster into summaries by entity,
                    topic, and time. Find patterns across your organization.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Memory Visual */}
          <div className="lg:col-span-8 h-full">
            <NeuralMemoryVisual />
          </div>
        </div>
      </div>

      {/* Changelog Section */}
      <div className="section-gap-b">
        <div className="bg-accent/40 p-6 border border-none rounded-sm">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
              Updates
            </p>
            <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl text-foreground">
              Changelog
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              See the latest improvements, features, and fixes across Lightfast.
            </p>
          </div>
          <div className="mt-6">
            <Button variant="secondary" asChild>
              <Link href="/changelog">View Changelog</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
