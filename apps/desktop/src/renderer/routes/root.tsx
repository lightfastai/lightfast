import { ClerkLoaded } from "@clerk/clerk-react";
import { createRoot } from "react-dom/client";

import { Toaster } from "@repo/ui/components/ui/sonner";

import { InnerApp } from "../components/router/inner-app";
import { HubClerkProvider } from "../providers/clerk-provider";

export const Root = () => {
  return (
    <HubClerkProvider>
      {/* Define a /sso-callback route that handle the OAuth redirect flow */}
      <ClerkLoaded>
        <InnerApp />
      </ClerkLoaded>
      <Toaster />
    </HubClerkProvider>
  );
};

const el = document.getElementById("root");

if (el) {
  createRoot(el).render(<Root />);
}
