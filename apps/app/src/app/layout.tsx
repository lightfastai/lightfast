import "@repo/ui/globals.css";

import { ClerkProvider } from "@clerk/nextjs";

import { TRPCReactProvider } from "@repo/trpc-client/trpc-react-provider";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";

import { env } from "~/env";

interface RootLayoutProperties {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <ClerkProvider publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" suppressHydrationWarning>
        <head />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <body className={cn("dark bg-background min-h-screen", fonts)}>
          <TRPCReactProvider baseUrl={env.NEXT_PUBLIC_LIGHTFAST_API_URL}>
            {children}
          </TRPCReactProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
