import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Braintrust Integration",
  description: "Braintrust setup for AI evaluation and monitoring with Lightfast",
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
