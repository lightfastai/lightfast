import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next.js AI Chatbot",
  description: "AI chatbot built with Next.js and Lightfast",
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
