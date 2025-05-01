import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { HubClerkProvider } from "./providers/clerk-provider";
import { router } from "./routes/router";

export default function App() {
  // useEffect(() => {
  //   syncThemeWithLocal();
  // }, []);

  return (
    <HubClerkProvider>
      <div className="bg-background text-foreground flex h-screen w-screen flex-col overflow-hidden">
        <RouterProvider router={router} />
      </div>
    </HubClerkProvider>
  );
}

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
