import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";
import { HeroDescription } from "~/components/landing/hero-description";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
import { BuildShipMonitorSection } from "~/components/landing/build-ship-monitor-section";
import { SiteFooter } from "~/components/landing/footer-section";
import { MarketingHeader } from "~/components/marketing/marketing-header";
import localFont from "next/font/local";

const exposureTrial = localFont({
  src: "../../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export default function HomePage() {
  return (
    <>
      <div className="dark bg-background flex flex-col min-h-screen">
        <MarketingHeader />
        {/* Main Content Section */}
        <div className="flex flex-col flex-1 border-b border-dashed border-border">
          {/* Top dashed line */}
          <div className="border-t border-dashed border-border" />

          {/* Content wrapper with fixed top position */}
          <div className="flex flex-1 items-start">
            {/* Content sections */}
            <div className="flex w-full mt-[20vh]">
              {/* Left Section */}
              <div className="flex flex-1 items-start px-16 py-16 border-r border-dashed border-border">
                <div className="w-full">
                  <div className="-mx-16 border-t border-dashed border-border mb-8" />
                  <div className="space-y-8">
                    <h1
                      className={`text-7xl font-light leading-[1.2] tracking-[-0.7] text-foreground whitespace-nowrap ${exposureTrial.className}`}
                    >
                      One interface, infinite agents.
                    </h1>
                    <div className="max-w-3xl">
                      <WaitlistForm />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Section */}
              <div className="flex items-start px-16 py-16">
                <div className="w-max min-w-xl max-w-xl">
                  <div className="-mx-16 border-t border-dashed border-border mb-8" />
                  <HeroDescription />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Framework Showcase */}
        <div className="px-16 py-16 border-t border-dashed border-border">
          <FrameworkShowcase />
        </div>
      </div>

      {/* Why Cloud Infrastructure Section */}
      <div className="dark">
        <WhyCloudInfrastructureSection />
      </div>

      {/* Manifesto Grid Section - Outside hero container */}
      <div className="manifesto bg-background px-16 py-48">
        <ManifestoGrid />
      </div>

      {/* Centered Waitlist Section */}
      <div className="dark">
        <CenteredWaitlistSection />
      </div>

      {/* Ready to Orchestrate Section */}
      <div className="dark">
        <ReadyToOrchestrateSection />
      </div>

      {/* Footer Section */}
      <div className="dark">
        <SiteFooter />
      </div>
    </>
  );
}
