import React, { useEffect } from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { router } from "./routes/router";

import "@repo/ui/globals.css";

import { BlenderStatusIndicator } from "./components/blender-status-indicator";
import { useBlenderStore } from "./stores/blender-store";

export default function App() {
  const initializeListener = useBlenderStore(
    (state) => state.initializeListener,
  );

  useEffect(() => {
    const cleanup = initializeListener();
    return cleanup;
  }, [initializeListener]);

  return (
    <div className="dark bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
      <div className="relative flex-1 overflow-auto">
        <RouterProvider router={router} />
        <BlenderStatusIndicator />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
