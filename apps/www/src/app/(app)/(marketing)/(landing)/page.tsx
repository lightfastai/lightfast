import { HeroDescription } from "~/components/landing/hero-description";
import { IntegrationShowcase } from "~/components/landing/integration-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { HeroWaitlistSection } from "~/components/landing/hero-waitlist-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
import { DeusShowcase } from "~/components/landing/deus-showcase";
import { ThreeCardShowcase } from "~/components/landing/three-card-showcase";

export default function HomePage() {
  return (
    <>
      {/* Hero Waitlist Section */}
      <div className="pt-48 px-16">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-xl">
            <HeroWaitlistSection />
          </div>
        </div>
      </div>

      {/* Deus Showcase Section */}
      <div className="flex flex-col py-32 items-center justify-center px-16">
        <div className="w-full max-w-7xl mx-auto">
          <div className="h-[900px] w-full">
            <DeusShowcase />
          </div>
        </div>
      </div>

      {/* Bottom Section: Integration Showcase */}
      <div className="px-16 py-16 w-full flex justify-center">
        <div className="max-w-7xl mx-auto">
          <IntegrationShowcase />
        </div>
      </div>

      {/* Why Cloud Infrastructure Section */}
      <div className="manifesto-page py-20 px-16">
        <div className="max-w-7xl mx-auto">
          <WhyCloudInfrastructureSection />
        </div>
      </div>

      {/* Three Card Showcase Section */}
      <div className="py-32 px-16 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
                <span>See Lightfast in Action</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                Deep context understanding, team unblocking, and intelligent orchestration
              </h2>
            </div>
            <ThreeCardShowcase />
          </div>
        </div>
      </div>
    </>
  );
}
