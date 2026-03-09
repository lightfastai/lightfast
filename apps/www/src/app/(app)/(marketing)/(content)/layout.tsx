import { WaitlistCTA } from "~/components/waitlist-cta";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Scrollable content */}
      <div className="page-gutter flex min-w-0 flex-1 flex-col overflow-hidden pt-[var(--content-pt)] [--content-pt:6rem]">
        {children}
      </div>

      {/* Waitlist CTA */}
      <div className="flex flex-col gap-48">
        <WaitlistCTA />
      </div>
    </div>
  );
}
