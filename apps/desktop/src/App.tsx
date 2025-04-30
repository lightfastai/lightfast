import React, { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { syncThemeWithLocal } from "./helpers/theme_helpers";
import { router } from "./routes/router";

export default function App() {
  useEffect(() => {
    syncThemeWithLocal();
  }, []);

  return (
    <div
      className={
        "bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden"
      }
    >
      <div className="relative flex-1 overflow-auto">
        <RouterProvider router={router} />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
