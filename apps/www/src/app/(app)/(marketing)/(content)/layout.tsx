import { WaitlistCTA } from "~/components/waitlist-cta";
import { DocsCTA } from "~/components/docs-cta";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background flex-col min-h-full">
      {/* Scrollable content */}
      <div className="flex-1 page-gutter">{children}</div>

      {/* Waitlist CTA */}
      <div className="gap-48 flex-col flex py-32">
        <div className="page-gutter">
          <div className="max-w-4xl mx-auto">
            <WaitlistCTA />
          </div>
        </div>

        {/* Docs CTA */}
        <div className="page-gutter">
          <DocsCTA />
        </div>
      </div>
    </div>
  );
}
