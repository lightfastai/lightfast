export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="legal-content-wrapper flex min-h-full flex-col border-b bg-background">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4">{children}</div>
    </div>
  );
}
