import React, { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { router } from "./routes/router";

import "./styles.css";

import { EnvProvider } from "./providers/env-provider";

export default function App() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  return (
    <EnvProvider>
      <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
        <RouterProvider router={router} />
      </div>
    </EnvProvider>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
