export default function NewWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4">{children}</div>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </>
  );
}
