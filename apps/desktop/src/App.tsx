import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { queryClient } from "@vendor/trpc/client/react-proxy";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { router } from "./routes/router";

import "./styles.css";

import { EnvProvider } from "./providers/env-provider";

export default function App() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);
  console.log(import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL);
  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      {/* <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      > */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      {/* </ClerkProvider> */}
    </div>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <EnvProvider>
      <App />
    </EnvProvider>
  </React.StrictMode>,
);
