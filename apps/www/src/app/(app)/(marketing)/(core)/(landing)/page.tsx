import { HeroDescription } from "~/components/landing/hero-description";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { HeroWaitlistSection } from "~/components/landing/hero-waitlist-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";

export default function HomePage() {
  return (
    <>
      {/* Hero Waitlist Section */}
      <div className="pt-48 px-16">
        <div className="max-w-7xl mx-auto">
          <HeroWaitlistSection />
        </div>
      </div>

      {/* Manifesto Grid Section - First component at top */}
      <div className="flex flex-col py-32 items-center justify-center">
        <div className="manifesto bg-background p-4 rounded-md">
          <div className="h-[700px] w-full max-w-7xl mx-auto">
            <ManifestoGrid />
          </div>
        </div>
      </div>

      {/* Bottom Section: Framework Showcase */}
      <div className="px-16 py-16 w-full flex justify-center">
        <div className="max-w-7xl mx-auto">
          <FrameworkShowcase />
        </div>
      </div>

      {/* Why Cloud Infrastructure Section */}
      <div className="dark">
        <WhyCloudInfrastructureSection />
      </div>
    </>
  );
}
