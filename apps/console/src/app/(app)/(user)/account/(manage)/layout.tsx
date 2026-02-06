export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col h-full overflow-auto">
      <div className="flex justify-center w-full">
        <div className="w-full max-w-5xl px-6 py-2">
          {children}
        </div>
      </div>
    </div>
  );
}
