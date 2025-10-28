export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark bg-background h-screen w-screen overflow-hidden">{children}</div>;
}
