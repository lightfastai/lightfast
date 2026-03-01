import { NewPageHeader } from "./_components/new-page-header";

export default function NewWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1 bg-background overflow-y-auto">
      <NewPageHeader />
      {children}
      <div aria-hidden className="shrink-0 h-16 md:h-20" />
    </div>
  );
}
