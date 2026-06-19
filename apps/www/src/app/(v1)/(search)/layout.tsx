export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark h-screen w-screen overflow-hidden bg-background backdrop-blur-sm">
      {children}
    </div>
  );
}
