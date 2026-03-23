// perf/sign-in-isolation — STEP 0: bare auth layout (no ClerkProvider, no MFE link)
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
