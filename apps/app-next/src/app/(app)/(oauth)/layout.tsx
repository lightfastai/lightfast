export default function OAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-screen w-full overflow-y-auto">{children}</div>;
}
