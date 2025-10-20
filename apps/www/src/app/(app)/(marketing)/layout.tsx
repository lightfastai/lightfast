export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-background min-h-screen overflow-x-hidden">
      {children}
    </div>
  );
}
