import { InnerApp } from "@/renderer/components/router/inner-app";
import { HubClerkProvider } from "@/renderer/providers/clerk-provider";
import { queryClient } from "@/renderer/providers/QueryClient";
import { ClerkLoaded } from "@clerk/clerk-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { Toaster } from "@repo/ui/components/ui/sonner";

export const Root = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <HubClerkProvider>
        {/* Define a /sso-callback route that handle the OAuth redirect flow */}
        <ClerkLoaded>
          <InnerApp />
        </ClerkLoaded>
        <Toaster />
      </HubClerkProvider>
    </QueryClientProvider>
  );
};

const el = document.getElementById("root");

if (el) {
  createRoot(el).render(<Root />);
}
