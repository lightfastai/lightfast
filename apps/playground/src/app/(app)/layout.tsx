import { PlaygroundHeader } from "~/components/playground-header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-screen flex-col relative">
      <PlaygroundHeader />
      <div className="flex-1 flex flex-col lg:pt-0 min-h-0">
        {children}
      </div>
    </main>
  );
}