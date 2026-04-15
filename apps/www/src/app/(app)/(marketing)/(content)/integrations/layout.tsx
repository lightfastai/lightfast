export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full min-w-0 max-w-6xl pt-24 pb-32">
        {children}
      </div>
    </div>
  );
}
