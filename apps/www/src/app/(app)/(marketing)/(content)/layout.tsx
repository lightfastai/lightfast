import { GetStartedCTA } from "~/app/(app)/_components/get-started-cta";

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

      {/* Get started CTA */}
      <div className="flex flex-col gap-48">
        <GetStartedCTA />
      </div>
    </div>
  );
}
