// perf/sign-in-isolation — STEP 0: bare root layout (no fonts, no analytics, no MFE)
import type { ReactNode } from "react";

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
