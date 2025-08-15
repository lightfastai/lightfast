import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Human-in-the-Loop Dashboard",
  description: "Interactive dashboard for human review workflows with Lightfast",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
