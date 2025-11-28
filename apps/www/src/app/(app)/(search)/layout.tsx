export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark bg-background/80 backdrop-blur-sm h-screen w-screen overflow-hidden">
      {children}
    </div>
  );
}
