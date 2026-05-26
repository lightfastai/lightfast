export default function OAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
