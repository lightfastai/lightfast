export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="legal-content-wrapper flex bg-background flex-col min-h-full">
      <div className="flex-1 max-w-7xl mx-auto px-4 w-full">{children}</div>
    </div>
  );
}
