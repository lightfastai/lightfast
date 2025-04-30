import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { router } from "./routes/router";

import "@repo/ui/globals.css";

import { BlenderStatusIndicator } from "./components/BlenderStatusIndicator";

export default function App() {
  // useEffect(() => {
  //   const cleanup = useBlenderStore.getState().initializeListener();
  //   return cleanup;
  // }, []);

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
