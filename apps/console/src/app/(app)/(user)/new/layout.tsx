import { NewPageHeader } from "./_components/new-page-header";

export default function NewWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1 bg-background overflow-y-auto">
      <NewPageHeader />
      <div className="mx-auto w-full max-w-2xl px-4">
        {children}
      </div>
      <div aria-hidden className="shrink-0 h-16 md:h-20" />
    </div>
  );
}
