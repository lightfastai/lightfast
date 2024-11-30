import type { ReactNode } from "react";

import "@repo/ui/globals.css";

import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

type RootLayoutProperties = {
  readonly children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html lang="en" suppressHydrationWarning>
    <head />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <body className={cn("dark min-h-screen bg-background", fonts)}>
      {children}
    </body>
  </html>
);

export default RootLayout;
