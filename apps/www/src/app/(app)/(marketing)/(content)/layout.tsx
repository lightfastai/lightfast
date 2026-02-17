import { WaitlistCTA } from "~/components/waitlist-cta";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background flex-col min-h-full">
      {/* Scrollable content */}
      <div className="flex-1 flex flex-col page-gutter pt-[var(--content-pt)] [--content-pt:6rem] min-w-0 overflow-hidden">{children}</div>

      {/* Waitlist CTA */}
      <div className="gap-48 flex-col flex">
        <WaitlistCTA />
      </div>
    </div>
  );
}
