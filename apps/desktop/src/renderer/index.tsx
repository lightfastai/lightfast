import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

import "@repo/ui/globals.css";

import { cn } from "@repo/ui/lib/utils";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <div
      className={cn(
        "dark bg-background text-foreground min-h-screen",
        "touch-manipulation font-sans antialiased",
      )}
    >
      <App />
    </div>
  </React.StrictMode>,
);
