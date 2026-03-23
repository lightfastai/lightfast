// perf/sign-in-isolation — STEP 0: bare root layout (no fonts, no analytics, no MFE)
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
