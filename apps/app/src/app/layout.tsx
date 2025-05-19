import "@repo/ui/globals.css";

import { TRPCReactProvider } from "@repo/trpc-client/trpc-react-provider";
import { Toaster } from "@repo/ui/components/ui/toaster";
import { fonts } from "@repo/ui/lib/fonts";
import { cn } from "@repo/ui/lib/utils";
import { $TRPCSource } from "@vendor/trpc/headers";

interface RootLayoutProperties {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <body className={cn("dark bg-background min-h-screen", fonts)}>
<<<<<<< HEAD
        <TRPCReactProvider source={$TRPCSource.Enum["lightfast-app"]}>
=======
        <TRPCReactProvider baseUrl={env.NEXT_PUBLIC_LIGHTFAST_API_URL}>
>>>>>>> 013be9a9 (refactor: transition from Clerk to OpenAuth for authentication management)
          {children}
        </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
