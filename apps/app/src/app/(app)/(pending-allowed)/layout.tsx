export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
      {children}
    </div>
  );
}
