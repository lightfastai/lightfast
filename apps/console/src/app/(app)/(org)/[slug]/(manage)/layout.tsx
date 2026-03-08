export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-auto">
      <div className="flex w-full justify-center">
        <div className="w-full max-w-5xl px-6 py-2">{children}</div>
      </div>
    </div>
  );
}
