import { HeroDescription } from "~/components/landing/hero-description";
import { IntegrationShowcase } from "~/components/landing/integration-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import { exposureTrial } from "~/lib/fonts";
import { LightfastEngineVisual } from "~/components/landing/lightfast-engine-visual";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
import { DeusShowcase } from "~/components/landing/deus-showcase";
import { ThreeCardShowcase } from "~/components/landing/three-card-showcase";

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <div className="pb-32">
        <div className="space-y-12">
          <div className="space-y-3">
            <h1
              className={`text-6xl font-light leading-[1.2] tracking-[-0.7] text-foreground ${exposureTrial.className}`}
            >
              One interface, infinite agents.
            </h1>
            <p className="text-md text-muted-foreground leading-relaxed max-w-md">
              One conversation orchestrates countless agents working across
              Linear, GitHub, PostHog, and your entire startup stack.
            </p>
          </div>

          <div className="max-w-xl">
            <WaitlistForm />
          </div>
        </div>
      </div>

      {/* Engine Section - Grid Layout */}
      <div className="pb-32">
        <div className="grid grid-cols-1 bg-card border border-border rounded-sm p-6 lg:grid-cols-12 gap-16">
          {/* Left Column: Engine Description (5/12) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest font-mono text-muted-foreground">
                Engine
              </p>
              <h3 className="text-3xl font-base leading-tight sm:text-3xl lg:text-2xl max-w-sm text-foreground">
                Focus on building
              </h3>
            </div>
            <div className="flex-1 flex items-center">
              <div className="space-y-6 -mt-8">
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Lightfast Sync Engine
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Built for deep reasoning and complex orchestration.
                    Maintains context across multi-step workflows and
                    coordinates your entire stack.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Deep Context Graph
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Unified understanding across your codebase, business
                    content, and tools. Correlates GitHub commits, Linear
                    issues, PostHog analytics, and Sentry errors as one
                    knowledge graph.
                  </p>
                </div>
                <div>
                  <h4 className="text-md font-semibold mb-2 text-foreground">
                    Security by Design
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Sandboxed execution for every workflow. Scoped credentials,
                    runtime validation, and human-in-the-loop for critical
                    actions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Engine Visual (7/12) */}
          <div className="lg:col-span-7 h-full">
            <LightfastEngineVisual />
          </div>
        </div>
      </div>

      {/* Integration Showcase Section */}
      <div className="py-16">
        <div className="w-full">
          <IntegrationShowcase />
        </div>
      </div>

      {/* Deus Showcase Section */}
      <div className="flex flex-col py-32 items-center justify-center">
        <div className="w-full">
          <div className="h-[900px] w-full">
            <DeusShowcase />
          </div>
        </div>
      </div>

      {/* Why Cloud Infrastructure Section */}
      <div className="py-20">
        <div className="w-full">
          <WhyCloudInfrastructureSection />
        </div>
      </div>

      {/* Three Card Showcase Section */}
      <div className="py-32 bg-background">
        <div className="w-full">
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
                <span>See Lightfast in Action</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                Deep context understanding, team unblocking, and intelligent
                orchestration
              </h2>
            </div>
            <ThreeCardShowcase />
          </div>
        </div>
      </div>
    </>
  );
}
