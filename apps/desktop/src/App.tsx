import React, { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { TRPCReactProvider } from "@vendor/trpc/client/react";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { router } from "./routes/router";

import "./styles.css";

import { EnvProvider } from "./providers/env-provider";

export default function App() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);
  console.log(process.env.VITE_PUBLIC_LIGHTFAST_API_URL);
  return (
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      {/* <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      > */}
      <TRPCReactProvider baseUrl={process.env.VITE_PUBLIC_LIGHTFAST_API_URL}>
        <RouterProvider router={router} />
      </TRPCReactProvider>
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
