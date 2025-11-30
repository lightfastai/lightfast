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
      <div className="gap-48 flex-col flex py-10">
        <WaitlistCTA />
      </div>
    </div>
  );
}
