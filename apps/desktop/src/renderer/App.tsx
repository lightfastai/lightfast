import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { Toaster } from "@repo/ui/components/ui/toaster";

import { HubClerkProvider } from "./providers/clerk-provider";
import { router } from "./routes/router";

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <HubClerkProvider>
        <RouterProvider router={router} />
        <Toaster />
      </HubClerkProvider>
    </div>
  </React.StrictMode>,
);
