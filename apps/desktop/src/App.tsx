import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { router } from "./routes/router";

import "@repo/ui/globals.css";

export default function App() {
  return (
    <div className="dark bg-background text-foreground h-screen w-screen overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
