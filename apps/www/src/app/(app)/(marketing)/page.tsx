import { WaitlistForm } from "./_components/(waitlist)/waitlist-form";
import { WaitlistDescription } from "./_components/(waitlist)/waitlist-description";
import { FrameworkShowcase } from "~/components/landing/framework-showcase";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { WhyCloudInfrastructureSection } from "~/components/landing/why-cloud-infrastructure-section";
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
      <div className="bg-background flex flex-col min-h-screen">
        <MarketingHeader />
        {/* Main Content Section */}
        <div className="flex flex-1 border-b border-dashed border-border">
          {/* Left Section */}
          <div className="flex flex-col flex-1 px-16 py-16 border-r border-dashed border-border">
            {/* Headline and Waitlist Form */}
            <div className="flex-1 flex flex-col justify-center w-full relative">
              {/* Dotted line above */}
              <div className="-mx-16 border-t border-dashed border-border mb-8" />

              <div className="space-y-8 w-full px-0">
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
          <div className="flex flex-col px-16 py-16 justify-end relative">
            {/* Waitlist Description */}
            <div className="max-w-xl">
              {/* Dashed line above */}
              <div className="-mx-16 border-t border-dashed border-border mb-8" />
              <WaitlistDescription />
            </div>
          </div>
        </div>

        {/* Bottom Section: Framework Showcase */}
        <div className="px-16 py-16 border-t border-dashed border-border">
          <FrameworkShowcase />
        </div>
      </div>

      {/* Why Cloud Infrastructure Section */}
      <WhyCloudInfrastructureSection />

      {/* Manifesto Grid Section - Outside hero container */}
      <div className="manifesto bg-background px-16 py-48">
        <ManifestoGrid />
      </div>

      {/* Centered Waitlist Section */}
      <div className="dark">
        <CenteredWaitlistSection />
      </div>

      {/* Footer Section */}
      <div className="dark">
        <SiteFooter />
      </div>
    </>
  );
}
