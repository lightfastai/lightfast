import type { ReactNode } from "react";

import "@repo/ui/globals.css";

import { ClerkProvider } from "@clerk/nextjs";

import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

import { env } from "~/env";

type RootLayoutProperties = {
  readonly children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <ClerkProvider
    publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    allowedRedirectOrigins={[
      "http://localhost:4100",
      "http://localhost:4101",
      "http://localhost:4102",
    ]}
  >
    <html lang="en" suppressHydrationWarning>
      <head />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <body className={cn("dark min-h-screen bg-background", fonts)}>
        {children}
      </body>
    </html>
  </ClerkProvider>
);

export default RootLayout;
