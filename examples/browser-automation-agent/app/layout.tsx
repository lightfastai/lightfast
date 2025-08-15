import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Browser Automation Agent",
  description: "Web scraping and automation with Browserbase and Lightfast",
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
