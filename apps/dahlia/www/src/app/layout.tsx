import type { Metadata } from "next";

import "@repo/ui/globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Toaster } from "@repo/ui/components/ui/toaster";
import { cn } from "@repo/ui/lib/utils";

export const metadata: Metadata = {
  title: "Jeevan Pillay | Brand",
  description: "", // @TODO
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <body
        className={cn(
          "dark min-h-screen bg-background font-sans antialiased",
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <div className="relative flex min-h-screen flex-col bg-background">
          {children}
        </div>
        <Toaster />
      </body>
    </html>
  );
}
