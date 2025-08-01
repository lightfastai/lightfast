import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dark Army",
  description: "Minimal Next.js App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="dark min-h-screen bg-black">{children}</body>
    </html>
  );
}