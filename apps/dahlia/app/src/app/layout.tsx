import "@repo/ui/globals.css";

import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

import { TRPCReactProvider } from "../trpc/react";

type RootLayoutProperties = {
  readonly children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <body className={cn("dark min-h-screen bg-background", fonts)}>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
