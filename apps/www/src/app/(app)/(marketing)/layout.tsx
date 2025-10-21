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
    </div>
  );
}
