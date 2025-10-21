import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { SiteFooter } from "~/components/landing/footer-section";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-background min-h-screen overflow-x-hidden">
      {children}

      {/* Shared footer sections for all marketing pages */}
      {/* Centered Waitlist Section */}
      <div className="dark bg-background pt-36 pb-36">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto">
            <CenteredWaitlistSection />
          </div>
        </div>
      </div>

      {/* Ready to Orchestrate Section */}
      <div className="dark bg-background py-16">
        <div className="max-w-7xl mx-auto">
          <ReadyToOrchestrateSection />
        </div>
      </div>

      {/* Footer Section */}
      <div className="dark bg-background py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
