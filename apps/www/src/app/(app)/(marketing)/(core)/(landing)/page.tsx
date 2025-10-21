import { HeroDescription } from "~/components/landing/hero-description";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { HeroWaitlistSection } from "~/components/landing/hero-waitlist-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
import { DeusShowcase } from "~/components/landing/deus-showcase";

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

      {/* Manifesto Grid Section */}
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
      <div className="manifesto-page py-20 sm:py-24 lg:pt-32 lg:pb-56 px-16">
        <div className="max-w-7xl mx-auto">
          <WhyCloudInfrastructureSection />
        </div>
      </div>
    </>
  );
}
